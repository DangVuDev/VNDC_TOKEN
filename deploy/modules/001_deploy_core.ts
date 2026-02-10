import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";

const func = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log(`\n${"=".repeat(60)}`);
  log("🚀 Deploying Module 001: Core System");
  log(`Network: ${network.name}`);
  log(`Deployer: ${deployer}`);
  log(`${"=".repeat(60)}\n`);

  try {
    // ==================== Deploy VNDC Token ====================
    log("📝 Deploying VNDC Token (ERC-20)...");
    const initialSupply = ethers.parseEther("1000000000"); // 1 billion tokens

    const vndc = await deploy("VNDC", {
      from: deployer,
      args: [ethers.parseEther("1000000000")], // Initial supply
      log: false,
      waitConfirmations: network.name === "localhost" ? 1 : 3,
      skipIfAlreadyDeployed: false,
    });

    log(`✅ VNDC Token deployed at: ${vndc.address}`);
    log(`   Transaction: ${vndc.transactionHash}`);
    log(`   Gas used: ${(vndc as any).gasUsed}`);

    // ==================== Deploy VNDCRegistry ====================
    log("\n📝 Deploying VNDC Registry...");

    const registry = await deploy("VNDCRegistry", {
      from: deployer,
      args: [],
      log: false,
      waitConfirmations: network.name === "localhost" ? 1 : 3,
      skipIfAlreadyDeployed: false,
    });

    log(`✅ VNDC Registry deployed at: ${registry.address}`);
    log(`   Transaction: ${registry.transactionHash}`);
    log(`   Gas used: ${(registry as any).gasUsed}`);

    // ==================== Deploy AccessControl ====================
    log("\n📝 Deploying AccessControl...");

    const accessControl = await deploy("AccessControl", {
      from: deployer,
      args: [],
      log: false,
      waitConfirmations: network.name === "localhost" ? 1 : 3,
      skipIfAlreadyDeployed: false,
    });

    log(`✅ AccessControl deployed at: ${accessControl.address}`);
    log(`   Transaction: ${accessControl.transactionHash}`);
    log(`   Gas used: ${(accessControl as any).gasUsed}`);

    // ==================== Save Addresses ====================
    const deployedAddresses = {
      VNDC: vndc.address,
      VNDCRegistry: registry.address,
      AccessControl: accessControl.address,
      network: network.name,
      deployer: deployer,
      deployedAt: new Date().toISOString(),
    };

    log(`\n${"=".repeat(60)}`);
    log("📊 Deployment Summary");
    log(`${"=".repeat(60)}`);
    log(`VNDC Token:      ${deployedAddresses.VNDC}`);
    log(`Registry:        ${deployedAddresses.VNDCRegistry}`);
    log(`AccessControl:   ${deployedAddresses.AccessControl}`);
    log(`${"=".repeat(60)}\n`);

    // ==================== Connect to Contracts ====================
    if (network.name !== "hardhat") {
      log("⏳ Waiting for confirmations...");
      const vndcContract = await ethers.getContractAt("VNDC", vndc.address);
      const registryContract = await ethers.getContractAt(
        "VNDCRegistry",
        registry.address
      );
      const aclContract = await ethers.getContractAt(
        "AccessControl",
        accessControl.address
      );

      // ==================== Verify Deployment ====================
      log("\n✔️ Verifying deployment...");

      // Check VNDC
      const totalSupply = await vndcContract.totalSupply();
      log(`   VNDC total supply: ${ethers.formatEther(totalSupply)} tokens`);

      const balance = await vndcContract.balanceOf(deployer);
      log(`   Deployer balance: ${ethers.formatEther(balance)} tokens`);

      // Check Registry
      const registryStats = await registryContract.getRegistryStats();
      log(`   Registry users: ${registryStats.totalUsers}`);

      // Check AccessControl
      const accessStats = await aclContract.getAccessStats();
      log(`   Admins: ${accessStats.adminCount}`);

      log(`   Roles configured: ${(accessStats as any).roleCount}`);

      log("🎉 Module 001 deployment successful!\n");
    } else {
      log("🎉 Module 001 deployment successful (localhost)!\n");
    }

    return deployedAddresses;
  } catch (error) {
    log("\n❌ Deployment failed!");
    console.error(error);
    throw error;
  }
};

func.tags = ["Core", "001"];
func.dependencies = [] as string[];

export default func;
