import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy= async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy: hardhatDeploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("========== Deploying Module 003: Academic Rewards ==========");
  log(`Network: ${network.name}`);
  log(`Deployer: ${deployer}`);

  try {
    // Get deployed addresses from Module 001 and 002
    const coreDeployment = await deployments.get("VNDC");
    const registryDeployment = await deployments.get("VNDCRegistry");

    const vndcAddress = coreDeployment.address;
    const registryAddress = registryDeployment.address;

    // ============ Deploy AcademicBadgeNFT ============
    log("\n1. Deploying AcademicBadgeNFT contract...");
    const badgeDeploy = await hardhatDeploy("AcademicBadgeNFT", {
      from: deployer,
      args: [],
      log: true,
      waitConfirmations: network.name === "localhost" ? 0 : 3,
    });

    const badgeAddress = badgeDeploy.address;
    log(`✓ AcademicBadgeNFT deployed to: ${badgeAddress}`);

    // ============ Deploy AcademicReward ============
    log("\n2. Deploying AcademicReward contract...");
    const rewardDeploy = await hardhatDeploy("AcademicReward", {
      from: deployer,
      args: [badgeAddress, vndcAddress, registryAddress],
      log: true,
      waitConfirmations: network.name === "localhost" ? 0 : 3,
    });

    const rewardAddress = rewardDeploy.address;
    log(`✓ AcademicReward deployed to: ${rewardAddress}`);

    // ============ Post-Deployment Setup ============
    log("\n3. Setting up reward tiers...");

    const reward = await ethers.getContractAt("AcademicReward", rewardAddress);
    const badge = await ethers.getContractAt("AcademicBadgeNFT", badgeAddress);

    // Create badge types first
    log("   Creating badge types...");

    let tx = await badge.createBadge("ipfs://QmPremiumBadge");
    let receipt = await tx.wait();
    log(`   ✓ Premium badge created (ID: 0)`);

    tx = await badge.createBadge("ipfs://QmGoldBadge");
    receipt = await tx.wait();
    log(`   ✓ Gold badge created (ID: 1)`);

    tx = await badge.createBadge("ipfs://QmSilverBadge");
    receipt = await tx.wait();
    log(`   ✓ Silver badge created (ID: 2)`);

    tx = await badge.createBadge("ipfs://QmBronzeBadge");
    receipt = await tx.wait();
    log(`   ✓ Bronze badge created (ID: 3)`);

    // Transfer badge ownership to reward contract
    log("\n   Transferring badge ownership to AcademicReward...");
    tx = await badge.transferOwnership(rewardAddress);
    await tx.wait();
    log(`   ✓ Badge ownership transferred`);

    // Set reward tiers
    log("\n   Setting reward tiers...");

    // Premium: GPA >= 3.80, 100 VNDC
    tx = await reward.setRewardTier(0, "Premium", 380, ethers.parseEther("100"), 0);
    await tx.wait();
    log(`   ✓ Premium tier set (GPA >= 3.80, 100 VNDC, Badge 0)`);

    // Gold: GPA >= 3.50, 50 VNDC
    tx = await reward.setRewardTier(1, "Gold", 350, ethers.parseEther("50"), 1);
    await tx.wait();
    log(`   ✓ Gold tier set (GPA >= 3.50, 50 VNDC, Badge 1)`);

    // Silver: GPA >= 3.00, 25 VNDC
    tx = await reward.setRewardTier(2, "Silver", 300, ethers.parseEther("25"), 2);
    await tx.wait();
    log(`   ✓ Silver tier set (GPA >= 3.00, 25 VNDC, Badge 2)`);

    // Bronze: GPA >= 2.00, 10 VNDC
    tx = await reward.setRewardTier(3, "Bronze", 200, ethers.parseEther("10"), 3);
    await tx.wait();
    log(`   ✓ Bronze tier set (GPA >= 2.00, 10 VNDC, Badge 3)`);

    // ============ Verification ============
    log("\n4. Verifying deployment...");

    const badgeName = await (badge as any).name?.() ?? "ERC1155";
    log(`✓ Badge contract name: ${badgeName}`);

    // Verify tiers
    const premiumTier = await reward.getRewardTier(0);
    log(`✓ Premium tier verified: ${premiumTier.name}, Min GPA: ${Number((premiumTier as any).minGPA) / 100}`);

    // ============ Deployment Summary ============
    log("\n========== Deployment Complete ==========");
    log("\nDeployed Contracts:");
    log(`- AcademicBadgeNFT: ${badgeAddress}`);
    log(`- AcademicReward: ${rewardAddress}`);
    log(`- VNDC Token (Module 001): ${vndcAddress}`);
    log(`- VNDC Registry (Module 001): ${registryAddress}`);

    const deploymentAddresses = {
      badge: badgeAddress,
      reward: rewardAddress,
      deployedAt: new Date().toISOString(),
      network: network.name,
    };

    log("\nDeployment Summary:");
    log(JSON.stringify(deploymentAddresses, null, 2));

    return deploymentAddresses;
  } catch (error) {
    log(`❌ Deployment failed: ${error}`);
    throw error;
  }
};

deploy.tags = ["academic-rewards", "module-003"];
deploy.dependencies = ["Core"]; // Depends on Module 001

export default deploy;
