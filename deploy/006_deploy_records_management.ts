import { ethers, deployments, getNamedAccounts } from "hardhat";

async function main() {
  const { deployer } = await getNamedAccounts();
  
  console.log("\n========== Deploying Module 006: Records Management ==========\n");
  console.log(`Deployer: ${deployer}`);

  // ============ Deploy StudentRecordManager ============
  console.log("\n[1/1] Deploying StudentRecordManager...");
  const recordManagerFactory = await ethers.getContractFactory("StudentRecordManager", deployer);
  const recordManager = await recordManagerFactory.deploy();
  await recordManager.waitForDeployment();
  const recordManagerAddress = await recordManager.getAddress();
  console.log(`✓ StudentRecordManager deployed to: ${recordManagerAddress}`);

  // ============ Verify Deployments ============
  console.log("\n========== Deployment Summary ==========");
  console.log(`
StudentRecordManager: ${recordManagerAddress}

Total contracts deployed: 1
Network: ${(await ethers.provider.getNetwork()).name}
Block: ${await ethers.provider.getBlockNumber()}
  `);

  // ============ Save Deployment Info ============
  const deploymentInfo = {
    module: "006-records-management",
    timestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name,
    deployer: deployer,
    contracts: {
      StudentRecordManager: recordManagerAddress
    }
  };

  console.log("\nDeployment info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
