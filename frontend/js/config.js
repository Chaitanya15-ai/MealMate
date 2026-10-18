// ============================================================
// EDIT THIS after you deploy the contract (Phase 5 in README)
// Paste the address that `npx hardhat run scripts/deploy.js`
// prints out.
// ============================================================
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Chain ID your frontend expects MetaMask to be on.
// 31337 = Hardhat local network, 11155111 = Sepolia testnet.
const EXPECTED_CHAIN_ID = 31337;

const STATUS_LABELS = [
  "AVAILABLE",
  "ACCEPTED",
  "COLLECTED",
  "DISTRIBUTED",
  "EXPIRED",
  "CANCELLED",
];
