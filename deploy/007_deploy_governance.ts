import { ethers, deployments, getNamedAccounts } from "hardhat";

async function main() {
  const { deployer } = await getNamedAccounts();
  
  console.log("\n========== Deploying Module 007: Governance System ==========\n");
  console.log(`Deployer: ${deployer}`);

  // ============ Deploy GovernanceToken ============
  console.log("\n[1/2] Deploying GovernanceToken...");
  const tokenFactory = await ethers.getContractFactory("GovernanceToken", deployer);
  const governanceToken = await tokenFactory.deploy();
  await governanceToken.waitForDeployment();
  const tokenAddress = await governanceToken.getAddress();
  console.log(`✓ GovernanceToken deployed to: ${tokenAddress}`);

  // ============ Deploy StudentDAO ============
  console.log("\n[2/2] Deploying StudentDAO...");
  const daoFactory = await ethers.getContractFactory("StudentDAO", deployer);
  const studentDAO = await daoFactory.deploy();
  await studentDAO.waitForDeployment();
  const daoAddress = await studentDAO.getAddress();
  console.log(`✓ StudentDAO deployed to: ${daoAddress}`);

  // ============ Verify Deployments ============
  console.log("\n========== Deployment Summary ==========");
  console.log(`
GovernanceToken: ${tokenAddress}
StudentDAO:      ${daoAddress}

Total contracts deployed: 2
Network: ${(await ethers.provider.getNetwork()).name}
Block: ${await ethers.provider.getBlockNumber()}
  `);

  // ============ Save Deployment Info ============
  const deploymentInfo = {
    module: "007-governance",
    timestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name,
    deployer: deployer,
    contracts: {
      GovernanceToken: tokenAddress,
      StudentDAO: daoAddress
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
