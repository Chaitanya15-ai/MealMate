const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("FoodDonation", function () {
  let foodDonation;
  let admin, donor, ngo, otherNgo, stranger;

  beforeEach(async function () {
    [admin, donor, ngo, otherNgo, stranger] = await ethers.getSigners();

    const FoodDonation = await ethers.getContractFactory("FoodDonation");
    foodDonation = await FoodDonation.deploy();
    await foodDonation.waitForDeployment();
  });

  async function futureExpiry(secondsFromNow) {
    const latest = await time.latest();
    return latest + secondsFromNow;
  }

  describe("Registration", function () {
    it("allows a donor to register", async function () {
      await expect(foodDonation.connect(donor).registerDonor())
        .to.emit(foodDonation, "DonorRegistered")
        .withArgs(donor.address);

      const d = await foodDonation.donors(donor.address);
      expect(d.registered).to.equal(true);
    });

    it("prevents a donor from registering twice", async function () {
      await foodDonation.connect(donor).registerDonor();
      await expect(foodDonation.connect(donor).registerDonor()).to.be.revertedWith(
        "Donor already registered"
      );
    });

    it("allows an NGO to register but starts unapproved", async function () {
      await foodDonation.connect(ngo).registerNGO();
      const n = await foodDonation.ngos(ngo.address);
      expect(n.registered).to.equal(true);
      expect(n.approved).to.equal(false);
    });

    it("lets admin approve an NGO", async function () {
      await foodDonation.connect(ngo).registerNGO();
      await expect(foodDonation.connect(admin).approveNGO(ngo.address))
        .to.emit(foodDonation, "NGOApproved")
        .withArgs(ngo.address);

      const n = await foodDonation.ngos(ngo.address);
      expect(n.approved).to.equal(true);
    });

    it("prevents non-admin from approving an NGO", async function () {
      await foodDonation.connect(ngo).registerNGO();
      await expect(
        foodDonation.connect(stranger).approveNGO(ngo.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("prevents approving an NGO twice", async function () {
      await foodDonation.connect(ngo).registerNGO();
      await foodDonation.connect(admin).approveNGO(ngo.address);
      await expect(
        foodDonation.connect(admin).approveNGO(ngo.address)
      ).to.be.revertedWith("NGO already approved");
    });

    it("lets admin revoke a previously approved NGO", async function () {
      await foodDonation.connect(ngo).registerNGO();
      await foodDonation.connect(admin).approveNGO(ngo.address);

      await expect(foodDonation.connect(admin).revokeNGO(ngo.address))
        .to.emit(foodDonation, "NGORevoked")
        .withArgs(ngo.address);

      const n = await foodDonation.ngos(ngo.address);
      expect(n.approved).to.equal(false);

      // and a revoked NGO can no longer accept donations
      await foodDonation.connect(donor).registerDonor();
      const expiry = (await time.latest()) + 3600;
      await foodDonation
        .connect(donor)
        .createDonation("Rice", "Cooked Food", 10, "Kg", await time.latest(), expiry, "Somewhere", "");
      await expect(
        foodDonation.connect(ngo).acceptDonation(1)
      ).to.be.revertedWith("NGO not yet approved by admin");
    });

    it("prevents non-admin from revoking an NGO", async function () {
      await foodDonation.connect(ngo).registerNGO();
      await foodDonation.connect(admin).approveNGO(ngo.address);
      await expect(
        foodDonation.connect(stranger).revokeNGO(ngo.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("lets admin transfer admin rights to a new wallet", async function () {
      await expect(foodDonation.connect(admin).transferAdmin(stranger.address))
        .to.emit(foodDonation, "AdminTransferred")
        .withArgs(admin.address, stranger.address);

      expect(await foodDonation.admin()).to.equal(stranger.address);

      // old admin can no longer approve NGOs
      await foodDonation.connect(ngo).registerNGO();
      await expect(
        foodDonation.connect(admin).approveNGO(ngo.address)
      ).to.be.revertedWith("Only admin can perform this action");

      // new admin can
      await expect(foodDonation.connect(stranger).approveNGO(ngo.address)).to.emit(
        foodDonation,
        "NGOApproved"
      );
    });

    it("rejects transferring admin to the zero address", async function () {
      await expect(
        foodDonation.connect(admin).transferAdmin(ethers.ZeroAddress)
      ).to.be.revertedWith("New admin cannot be the zero address");
    });

    it("prevents non-admin from transferring admin rights", async function () {
      await expect(
        foodDonation.connect(stranger).transferAdmin(stranger.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });
  });

  describe("Creating donations", function () {
    beforeEach(async function () {
      await foodDonation.connect(donor).registerDonor();
    });

    it("lets a registered donor create a donation with a unique incrementing ID", async function () {
      const expiry = await futureExpiry(3600);
      await expect(
        foodDonation
          .connect(donor)
          .createDonation("Veg Biryani", "Cooked Food", 20, "Meals", await time.latest(), expiry, "ABC Restaurant", "")
      )
        .to.emit(foodDonation, "DonationCreated")
        .withArgs(1, donor.address, "Veg Biryani", expiry);

      const d2Expiry = await futureExpiry(7200);
      await foodDonation
        .connect(donor)
        .createDonation("Bread", "Bakery", 50, "Packets", await time.latest(), d2Expiry, "ABC Restaurant", "");

      const ids = await foodDonation.getAllDonationIds();
      expect(ids.map((i) => Number(i))).to.deep.equal([1, 2]);
    });

    it("rejects donations from unregistered donors", async function () {
      const expiry = await futureExpiry(3600);
      await expect(
        foodDonation
          .connect(stranger)
          .createDonation("Rice", "Cooked Food", 10, "Kg", await time.latest(), expiry, "Somewhere", "")
      ).to.be.revertedWith("Not a registered donor");
    });

    it("rejects a donation whose expiry is not in the future", async function () {
      const past = (await time.latest()) - 10;
      await expect(
        foodDonation
          .connect(donor)
          .createDonation("Rice", "Cooked Food", 10, "Kg", await time.latest(), past, "Somewhere", "")
      ).to.be.revertedWith("Expiry must be in the future");
    });
  });

  describe("Accepting donations", function () {
    let expiry;

    beforeEach(async function () {
      await foodDonation.connect(donor).registerDonor();
      await foodDonation.connect(ngo).registerNGO();
      await foodDonation.connect(admin).approveNGO(ngo.address);

      expiry = await futureExpiry(3600);
      await foodDonation
        .connect(donor)
        .createDonation("Veg Biryani", "Cooked Food", 20, "Meals", await time.latest(), expiry, "ABC Restaurant", "");
    });

    it("lets an approved NGO accept an available donation", async function () {
      await expect(foodDonation.connect(ngo).acceptDonation(1))
        .to.emit(foodDonation, "DonationAccepted")
        .withArgs(1, ngo.address);

      const d = await foodDonation.getDonation(1);
      expect(d.status).to.equal(1); // ACCEPTED
      expect(d.ngo).to.equal(ngo.address);
    });

    it("rejects acceptance from an unapproved NGO", async function () {
      await foodDonation.connect(otherNgo).registerNGO();
      await expect(
        foodDonation.connect(otherNgo).acceptDonation(1)
      ).to.be.revertedWith("NGO not yet approved by admin");
    });

    it("rejects acceptance of expired food", async function () {
      const shortExpiry = await futureExpiry(60);
      await foodDonation
        .connect(donor)
        .createDonation("Milk", "Packaged Food", 5, "Litres", await time.latest(), shortExpiry, "ABC Restaurant", "");

      await time.increase(120); // fast-forward past expiry

      await expect(
        foodDonation.connect(ngo).acceptDonation(2)
      ).to.be.revertedWith("Food has expired");
    });

    it("prevents accepting the same donation twice", async function () {
      await foodDonation.connect(ngo).acceptDonation(1);
      await foodDonation.connect(otherNgo).registerNGO();
      await foodDonation.connect(admin).approveNGO(otherNgo.address);

      await expect(
        foodDonation.connect(otherNgo).acceptDonation(1)
      ).to.be.revertedWith("Donation is not available");
    });
  });

  describe("Dual pickup confirmation and distribution", function () {
    beforeEach(async function () {
      await foodDonation.connect(donor).registerDonor();
      await foodDonation.connect(ngo).registerNGO();
      await foodDonation.connect(admin).approveNGO(ngo.address);

      const expiry = await futureExpiry(3600);
      await foodDonation
        .connect(donor)
        .createDonation("Veg Biryani", "Cooked Food", 20, "Meals", await time.latest(), expiry, "ABC Restaurant", "");
      await foodDonation.connect(ngo).acceptDonation(1);
    });

    it("only moves to COLLECTED once both donor and NGO confirm", async function () {
      await foodDonation.connect(donor).confirmPickupByDonor(1);
      let d = await foodDonation.getDonation(1);
      expect(d.status).to.equal(1); // still ACCEPTED

      await expect(foodDonation.connect(ngo).confirmPickupByNGO(1)).to.emit(
        foodDonation,
        "FoodCollected"
      );

      d = await foodDonation.getDonation(1);
      expect(d.status).to.equal(2); // COLLECTED
    });

    it("rejects handover confirmation from someone who isn't the donor", async function () {
      await expect(
        foodDonation.connect(stranger).confirmPickupByDonor(1)
      ).to.be.revertedWith("Only the donor can confirm handover");
    });

    it("lets the assigned NGO mark food distributed after collection", async function () {
      await foodDonation.connect(donor).confirmPickupByDonor(1);
      await foodDonation.connect(ngo).confirmPickupByNGO(1);

      await expect(foodDonation.connect(ngo).markDistributed(1, "Community Center A", 20))
        .to.emit(foodDonation, "FoodDistributed")
        .withArgs(1, "Community Center A", 20);

      const d = await foodDonation.getDonation(1);
      expect(d.status).to.equal(3); // DISTRIBUTED
      expect(d.peopleServed).to.equal(20);
    });

    it("prevents a distributed donation from being accepted again", async function () {
      await foodDonation.connect(donor).confirmPickupByDonor(1);
      await foodDonation.connect(ngo).confirmPickupByNGO(1);
      await foodDonation.connect(ngo).markDistributed(1, "Community Center A", 20);

      await expect(
        foodDonation.connect(ngo).acceptDonation(1)
      ).to.be.revertedWith("Donation is not available");
    });

    it("prevents distribution before collection", async function () {
      await expect(
        foodDonation.connect(ngo).markDistributed(1, "Community Center A", 20)
      ).to.be.revertedWith("Food must be collected first");
    });
  });

  describe("Cancellation and expiry", function () {
    beforeEach(async function () {
      await foodDonation.connect(donor).registerDonor();
    });

    it("lets the donor cancel an available donation", async function () {
      const expiry = await futureExpiry(3600);
      await foodDonation
        .connect(donor)
        .createDonation("Veg Biryani", "Cooked Food", 20, "Meals", await time.latest(), expiry, "ABC Restaurant", "");

      await expect(foodDonation.connect(donor).cancelDonation(1)).to.emit(
        foodDonation,
        "DonationCancelled"
      );

      const d = await foodDonation.getDonation(1);
      expect(d.status).to.equal(5); // CANCELLED
    });

    it("allows anyone to flip an overdue donation to EXPIRED", async function () {
      const shortExpiry = await futureExpiry(60);
      await foodDonation
        .connect(donor)
        .createDonation("Milk", "Packaged Food", 5, "Litres", await time.latest(), shortExpiry, "ABC Restaurant", "");

      await time.increase(120);

      await expect(foodDonation.connect(stranger).markExpired(1)).to.emit(
        foodDonation,
        "DonationExpired"
      );

      const d = await foodDonation.getDonation(1);
      expect(d.status).to.equal(4); // EXPIRED
    });
  });
});
