const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Deploying TemperatureLogger contract...");
  console.log("  Deployer:", deployer.address);
  console.log("═══════════════════════════════════════════════════════");

  const TemperatureLogger = await ethers.getContractFactory("TemperatureLogger");
  const contract = await TemperatureLogger.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("\n  ✅ TemperatureLogger deployed to:", contractAddress);

  // Authorize the Pico W device
  const DEVICE_ID = "pico-w-001";
  const tx = await contract.authorizeDevice(DEVICE_ID);
  await tx.wait();
  console.log(`  ✅ Device '${DEVICE_ID}' authorized`);

  // Write address to a JSON file for the relay server to pick up
  const fs = require("fs");
  const deployInfo = {
    contractAddress,
    deviceId: DEVICE_ID,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    "./deploy-info.json",
    JSON.stringify(deployInfo, null, 2)
  );

  console.log("\n  📄 deploy-info.json written");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
