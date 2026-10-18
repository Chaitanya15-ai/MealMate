// Deploys FoodDonation.sol and populates it with 6 realistic sample
// donations as REAL transactions on your local Hardhat blockchain - not
// hardcoded frontend data. Every FD001-FD006 shown by the app after running
// this is a genuine on-chain donation with its own transaction history.
//
// Run with: npm run seed:local
// (equivalent to: npx hardhat run scripts/seed.js --network localhost)
//
// Each sample organization is a different Hardhat test account, exactly
// like a real deployment would have different donors/NGOs on different
// wallets. See the printed table at the end for which account is which -
// import the matching private key into MetaMask (from your `npm run node`
// terminal output) if you want to browse the Donor page "as" one specific
// organization.

const hre = require("hardhat");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [
    admin,
    trident,
    cakeBake,
    chemburKitchen,
    seaPrincess,
    bigBazaar,
    diamondGarden,
    worliSevaSangh,
    chemburSevaTrust,
  ] = await hre.ethers.getSigners();

  const FoodDonation = await hre.ethers.getContractFactory("FoodDonation");
  const foodDonation = await FoodDonation.deploy();
  await foodDonation.waitForDeployment();
  const address = await foodDonation.getAddress();
  console.log("FoodDonation deployed to:", address);
  console.log("Copy this into frontend/js/config.js as CONTRACT_ADDRESS.\n");

  const HOUR = 3600;

  console.log("Registering donors and NGOs...");
  await (await foodDonation.connect(trident).registerDonor()).wait();
  await (await foodDonation.connect(cakeBake).registerDonor()).wait();
  await (await foodDonation.connect(chemburKitchen).registerDonor()).wait();
  await (await foodDonation.connect(seaPrincess).registerDonor()).wait();
  await (await foodDonation.connect(bigBazaar).registerDonor()).wait();
  await (await foodDonation.connect(diamondGarden).registerDonor()).wait();

  await (await foodDonation.connect(worliSevaSangh).registerNGO()).wait();
  await (await foodDonation.connect(chemburSevaTrust).registerNGO()).wait();
  await (await foodDonation.connect(admin).approveNGO(worliSevaSangh.address)).wait();
  await (await foodDonation.connect(admin).approveNGO(chemburSevaTrust.address)).wait();

  console.log("Creating donations FD001-FD006...");
  let now = (await hre.ethers.provider.getBlock("latest")).timestamp;

  // FD001 - Trident Hotel, Worli - AVAILABLE, expiring within a day
  await (
    await foodDonation
      .connect(trident)
      .createDonation(
        "Continental Buffet Surplus",
        "Cooked Food",
        25,
        "Meals",
        now,
        now + 18 * HOUR,
        "Trident Hotel Banquet Gate, Worli",
        ""
      )
  ).wait();

  // FD002 - Cake & Bake Bakery, Thane - AVAILABLE, safely out from expiry
  await (
    await foodDonation
      .connect(cakeBake)
      .createDonation(
        "Assorted Breads & Pastries",
        "Bakery",
        60,
        "Packets",
        now,
        now + 71 * HOUR,
        "Cake & Bake Bakery, Ghodbunder Road, Thane",
        ""
      )
  ).wait();

  // FD003 - Chembur Community Kitchen - full lifecycle, ends DISTRIBUTED
  await (
    await foodDonation
      .connect(chemburKitchen)
      .createDonation(
        "Dal-Rice Meal Boxes",
        "Cooked Food",
        45,
        "Meals",
        now,
        now + 6 * HOUR,
        "Community Kitchen, Tilak Nagar, Chembur",
        ""
      )
  ).wait();
  await (await foodDonation.connect(chemburSevaTrust).acceptDonation(3)).wait();
  await (await foodDonation.connect(chemburKitchen).confirmPickupByDonor(3)).wait();
  await (await foodDonation.connect(chemburSevaTrust).confirmPickupByNGO(3)).wait();
  await (
    await foodDonation
      .connect(chemburSevaTrust)
      .markDistributed(3, "Ambedkar Nagar Community Center", 45)
  ).wait();

  // FD004 - Hotel Sea Princess, Worli - ACCEPTED, donor confirmed, NGO hasn't yet
  await (
    await foodDonation
      .connect(seaPrincess)
      .createDonation(
        "Wedding Banquet Leftovers",
        "Cooked Food",
        80,
        "Meals",
        now,
        now + 10 * HOUR,
        "Hotel Sea Princess, Worli",
        ""
      )
  ).wait();
  await (await foodDonation.connect(worliSevaSangh).acceptDonation(4)).wait();
  await (await foodDonation.connect(seaPrincess).confirmPickupByDonor(4)).wait();
  // deliberately NOT calling confirmPickupByNGO - stays ACCEPTED so you can
  // demo the dual-confirmation step yourself

  // FD005 - Big Bazaar, Thane - AVAILABLE, expires in a few minutes so you
  // can watch it flip from "expiring soon" to actually EXPIRED live
  await (
    await foodDonation
      .connect(bigBazaar)
      .createDonation(
        "Packaged Groceries (near-expiry stock)",
        "Groceries",
        100,
        "Kg",
        now,
        now + 5 * 60,
        "Big Bazaar, Eastern Express Highway, Thane",
        ""
      )
  ).wait();

  // FD006 - Diamond Garden Banquet Hall, Chembur - create with a short
  // expiry, let a few real seconds pass, then mark it EXPIRED on-chain -
  // the same mechanism the original plan's demo described.
  now = (await hre.ethers.provider.getBlock("latest")).timestamp;
  await (
    await foodDonation
      .connect(diamondGarden)
      .createDonation(
        "Function Leftover Food",
        "Cooked Food",
        80,
        "Meals",
        now,
        now + 5,
        "Diamond Garden, Chembur",
        ""
      )
  ).wait();
  console.log("Waiting a few seconds so FD006 can actually expire on-chain...");
  await sleep(6000);
  await hre.network.provider.send("evm_mine"); // advance the chain's clock with an empty block
  await (await foodDonation.connect(admin).markExpired(6)).wait();

  console.log("\nDone. 6 donations seeded:");
  console.log("  FD001 Trident Hotel, Worli            - AVAILABLE (~18h left)");
  console.log("  FD002 Cake & Bake Bakery, Thane        - AVAILABLE (~3 days left)");
  console.log("  FD003 Chembur Community Kitchen        - DISTRIBUTED");
  console.log("  FD004 Hotel Sea Princess, Worli        - ACCEPTED (donor confirmed, NGO pending)");
  console.log("  FD005 Big Bazaar, Thane                - AVAILABLE (expires in ~5 min)");
  console.log("  FD006 Diamond Garden Banquet Hall, Chembur - EXPIRED");

  console.log("\nWallet -> organization mapping (import these from your `npm run node`");
  console.log("terminal's private key list if you want to browse the Donor/NGO page");
  console.log("logged in as a specific one):");
  console.log("  Account #0 -", admin.address, "- contract admin");
  console.log("  Account #1 -", trident.address, "- Trident Hotel (donor, FD001)");
  console.log("  Account #2 -", cakeBake.address, "- Cake & Bake Bakery (donor, FD002)");
  console.log("  Account #3 -", chemburKitchen.address, "- Chembur Community Kitchen (donor, FD003)");
  console.log("  Account #4 -", seaPrincess.address, "- Hotel Sea Princess (donor, FD004)");
  console.log("  Account #5 -", bigBazaar.address, "- Big Bazaar (donor, FD005)");
  console.log("  Account #6 -", diamondGarden.address, "- Diamond Garden Banquet Hall (donor, FD006)");
  console.log("  Account #7 -", worliSevaSangh.address, "- Worli Seva Sangh (NGO, accepted FD004)");
  console.log("  Account #8 -", chemburSevaTrust.address, "- Chembur Seva Trust (NGO, completed FD003)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
