// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Smart Food Donation & Expiry Tracker
/// @notice Tracks surplus food donations from Donors to NGOs on-chain,
///         enforcing expiry rules and providing a public, verifiable history.
contract FoodDonation {
    address public admin;

    enum Status {
        AVAILABLE,
        ACCEPTED,
        COLLECTED,
        DISTRIBUTED,
        EXPIRED,
        CANCELLED
    }

    // Only identity/role data lives on-chain. Organization name and location
    // are kept off-chain (see frontend/js/profile.js, stored per-wallet in
    // the browser) since this is public, permanent business info with no
    // need for blockchain-level trust guarantees - only the wallet's role
    // and status need to be tamper-resistant.
    struct Donor {
        bool registered;
    }

    struct NGO {
        bool registered;
        bool approved;
    }

    struct Donation {
        uint256 id;
        string foodName;
        string category;
        uint256 quantity;
        string unit;
        uint256 preparationTime;
        uint256 expiryTime;
        address donor;
        address ngo;
        string pickupLocation;
        string imageCID; // optional IPFS CID, empty string if none
        Status status;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 collectedAt;
        uint256 distributedAt;
        bool donorConfirmedHandover;
        bool ngoConfirmedCollection;
        string recipientGroup;
        uint256 peopleServed;
    }

    uint256 private nextDonationId = 1;

    mapping(address => Donor) public donors;
    mapping(address => NGO) public ngos;
    mapping(uint256 => Donation) public donations;

    uint256[] private allDonationIds;
    mapping(address => uint256[]) private donorDonationIds;
    mapping(address => uint256[]) private ngoDonationIds;

    // ---------- Events ----------
    event DonorRegistered(address indexed donor);
    event NGORegistered(address indexed ngo);
    event NGOApproved(address indexed ngo);
    event NGORevoked(address indexed ngo);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    event DonationCreated(uint256 indexed donationId, address indexed donor, string foodName, uint256 expiryTime);
    event DonationAccepted(uint256 indexed donationId, address indexed ngo);
    event DonorConfirmedHandover(uint256 indexed donationId);
    event NGOConfirmedCollection(uint256 indexed donationId);
    event FoodCollected(uint256 indexed donationId);
    event FoodDistributed(uint256 indexed donationId, string recipientGroup, uint256 peopleServed);
    event DonationCancelled(uint256 indexed donationId);
    event DonationExpired(uint256 indexed donationId);

    // ---------- Modifiers ----------
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyRegisteredDonor() {
        require(donors[msg.sender].registered, "Not a registered donor");
        _;
    }

    modifier onlyApprovedNGO() {
        require(ngos[msg.sender].registered, "Not a registered NGO");
        require(ngos[msg.sender].approved, "NGO not yet approved by admin");
        _;
    }

    modifier donationExists(uint256 _id) {
        require(donations[_id].id != 0, "Donation does not exist");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // ---------- Registration ----------

    function registerDonor() external {
        require(!donors[msg.sender].registered, "Donor already registered");
        donors[msg.sender] = Donor(true);
        emit DonorRegistered(msg.sender);
    }

    function registerNGO() external {
        require(!ngos[msg.sender].registered, "NGO already registered");
        ngos[msg.sender] = NGO(true, false);
        emit NGORegistered(msg.sender);
    }

    /// @notice Admin approves an NGO before it can accept donations.
    function approveNGO(address _ngo) external onlyAdmin {
        require(ngos[_ngo].registered, "NGO not registered");
        require(!ngos[_ngo].approved, "NGO already approved");
        ngos[_ngo].approved = true;
        emit NGOApproved(_ngo);
    }

    /// @notice Admin revokes a previously approved NGO (e.g. for misuse).
    ///         Donations it already accepted are unaffected; it simply can't
    ///         accept new ones until re-approved.
    function revokeNGO(address _ngo) external onlyAdmin {
        require(ngos[_ngo].registered, "NGO not registered");
        require(ngos[_ngo].approved, "NGO is not currently approved");
        ngos[_ngo].approved = false;
        emit NGORevoked(_ngo);
    }

    /// @notice Hands admin control to a new wallet. Use this if the deploying
    ///         wallet's key is at risk, or to hand the project off to someone
    ///         else - without it, losing the original admin key would mean
    ///         no NGO could ever be approved again.
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "New admin cannot be the zero address");
        address previous = admin;
        admin = _newAdmin;
        emit AdminTransferred(previous, _newAdmin);
    }

    // ---------- Donation lifecycle ----------

    function createDonation(
        string calldata _foodName,
        string calldata _category,
        uint256 _quantity,
        string calldata _unit,
        uint256 _preparationTime,
        uint256 _expiryTime,
        string calldata _pickupLocation,
        string calldata _imageCID
    ) external onlyRegisteredDonor returns (uint256) {
        require(_expiryTime > block.timestamp, "Expiry must be in the future");
        require(_quantity > 0, "Quantity must be greater than zero");

        uint256 id = nextDonationId++;

        Donation storage d = donations[id];
        d.id = id;
        d.foodName = _foodName;
        d.category = _category;
        d.quantity = _quantity;
        d.unit = _unit;
        d.preparationTime = _preparationTime;
        d.expiryTime = _expiryTime;
        d.donor = msg.sender;
        d.pickupLocation = _pickupLocation;
        d.imageCID = _imageCID;
        d.status = Status.AVAILABLE;
        d.createdAt = block.timestamp;

        allDonationIds.push(id);
        donorDonationIds[msg.sender].push(id);

        emit DonationCreated(id, msg.sender, _foodName, _expiryTime);
        return id;
    }

    function acceptDonation(uint256 _id) external onlyApprovedNGO donationExists(_id) {
        Donation storage d = donations[_id];
        require(d.status == Status.AVAILABLE, "Donation is not available");
        require(block.timestamp < d.expiryTime, "Food has expired");

        d.status = Status.ACCEPTED;
        d.ngo = msg.sender;
        d.acceptedAt = block.timestamp;

        ngoDonationIds[msg.sender].push(_id);

        emit DonationAccepted(_id, msg.sender);
    }

    /// @notice Donor confirms they handed the food over.
    function confirmPickupByDonor(uint256 _id) external donationExists(_id) {
        Donation storage d = donations[_id];
        require(msg.sender == d.donor, "Only the donor can confirm handover");
        require(d.status == Status.ACCEPTED, "Donation must be accepted first");

        d.donorConfirmedHandover = true;
        emit DonorConfirmedHandover(_id);

        if (d.ngoConfirmedCollection) {
            _markCollected(d);
        }
    }

    /// @notice Assigned NGO confirms they collected the food.
    function confirmPickupByNGO(uint256 _id) external donationExists(_id) {
        Donation storage d = donations[_id];
        require(msg.sender == d.ngo, "Only the assigned NGO can confirm collection");
        require(d.status == Status.ACCEPTED, "Donation must be accepted first");

        d.ngoConfirmedCollection = true;
        emit NGOConfirmedCollection(_id);

        if (d.donorConfirmedHandover) {
            _markCollected(d);
        }
    }

    function _markCollected(Donation storage d) private {
        d.status = Status.COLLECTED;
        d.collectedAt = block.timestamp;
        emit FoodCollected(d.id);
    }

    function markDistributed(
        uint256 _id,
        string calldata _recipientGroup,
        uint256 _peopleServed
    ) external donationExists(_id) {
        Donation storage d = donations[_id];
        require(msg.sender == d.ngo, "Only the assigned NGO can mark distributed");
        require(d.status == Status.COLLECTED, "Food must be collected first");

        d.status = Status.DISTRIBUTED;
        d.distributedAt = block.timestamp;
        d.recipientGroup = _recipientGroup;
        d.peopleServed = _peopleServed;

        emit FoodDistributed(_id, _recipientGroup, _peopleServed);
    }

    function cancelDonation(uint256 _id) external donationExists(_id) {
        Donation storage d = donations[_id];
        require(msg.sender == d.donor || msg.sender == admin, "Not authorized to cancel");
        require(
            d.status == Status.AVAILABLE || d.status == Status.ACCEPTED,
            "Cannot cancel at this stage"
        );

        d.status = Status.CANCELLED;
        emit DonationCancelled(_id);
    }

    /// @notice Anyone can call this to flip an overdue AVAILABLE donation to EXPIRED on-chain.
    function markExpired(uint256 _id) external donationExists(_id) {
        Donation storage d = donations[_id];
        require(d.status == Status.AVAILABLE, "Only available donations can expire");
        require(block.timestamp >= d.expiryTime, "Not yet expired");

        d.status = Status.EXPIRED;
        emit DonationExpired(_id);
    }

    // ---------- Views ----------

    function getDonation(uint256 _id) external view donationExists(_id) returns (Donation memory) {
        return donations[_id];
    }

    function getAllDonationIds() external view returns (uint256[] memory) {
        return allDonationIds;
    }

    function getDonorDonationIds(address _donor) external view returns (uint256[] memory) {
        return donorDonationIds[_donor];
    }

    function getNGODonationIds(address _ngo) external view returns (uint256[] memory) {
        return ngoDonationIds[_ngo];
    }

    function totalDonations() external view returns (uint256) {
        return allDonationIds.length;
    }
}
