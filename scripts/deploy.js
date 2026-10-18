const hre = require("hardhat");

async function main() {
  const FoodDonation = await hre.ethers.getContractFactory("FoodDonation");
  const foodDonation = await FoodDonation.deploy();
  await foodDonation.waitForDeployment();

  const address = await foodDonation.getAddress();
  console.log("FoodDonation deployed to:", address);
  console.log("\nCopy this address into frontend/js/config.js as CONTRACT_ADDRESS.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
