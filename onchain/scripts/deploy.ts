import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting VNDC Token deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy VNDCToken
  console.log("📦 Deploying VNDCToken...");
  const initialSupply = ethers.parseEther("100000000"); // 100 million tokens
  const VNDCTokenFactory = await ethers.getContractFactory("VNDCToken");
  const vndc = await VNDCTokenFactory.deploy(initialSupply);
  await vndc.waitForDeployment();
  const vndcAddress = await vndc.getAddress();
  console.log("✅ VNDCToken deployed to:", vndcAddress);
  console.log("   Initial Supply:", ethers.formatEther(await vndc.totalSupply()), "VNDC\n");

  // Deploy VNDCStaking
  console.log("📦 Deploying VNDCStaking...");
  const VNDCStakingFactory = await ethers.getContractFactory("VNDCStaking");
  const staking = await VNDCStakingFactory.deploy(vndcAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("✅ VNDCStaking deployed to:", stakingAddress);
  console.log("   Reward Rate: 10% APY");
  console.log("   Min Stake Amount:", ethers.formatEther(await staking.minStakeAmount()), "VNDC\n");

  // Deploy VNDCTokenVesting
  console.log("📦 Deploying VNDCTokenVesting...");
  const VNDCTokenVestingFactory = await ethers.getContractFactory("VNDCTokenVesting");
  const vesting = await VNDCTokenVestingFactory.deploy(vndcAddress);
  await vesting.waitForDeployment();
  const vestingAddress = await vesting.getAddress();
  console.log("✅ VNDCTokenVesting deployed to:", vestingAddress, "\n");

  // Approve staking contract to spend tokens
  console.log("🔐 Approving VNDCStaking to spend VNDCToken...");
  const approveTx = await vndc.approve(stakingAddress, ethers.MaxUint256);
  await approveTx.wait();
  console.log("✅ Approval completed\n");

  // Approve vesting contract to spend tokens
  console.log("🔐 Approving VNDCTokenVesting to spend VNDCToken...");
  const approveVestingTx = await vndc.approve(vestingAddress, ethers.MaxUint256);
  await approveVestingTx.wait();
  console.log("✅ Approval completed\n");

  // Print summary
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📊 Deployment Summary");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`VNDCToken Address:     ${vndcAddress}`);
  console.log(`VNDCStaking Address:   ${stakingAddress}`);
  console.log(`VNDCTokenVesting Address: ${vestingAddress}`);
  console.log(`Deployer Address:      ${deployer.address}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Save deployment addresses
  const deploymentConfig = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deploymentDate: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      VNDCToken: {
        address: vndcAddress,
        initialSupply: ethers.formatEther(initialSupply) + " VNDC",
      },
      VNDCStaking: {
        address: stakingAddress,
        rewardRate: "10% APY",
        minStakeAmount: ethers.formatEther(await staking.minStakeAmount()) + " VNDC",
      },
      VNDCTokenVesting: {
        address: vestingAddress,
      },
    },
  };

  console.log("💾 Deployment configuration:");
  console.log(JSON.stringify(deploymentConfig, null, 2));

  return deploymentConfig;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
