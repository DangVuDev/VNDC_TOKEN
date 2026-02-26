import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 018: Staking Pool ==========");
  console.log(`Deployer: ${deployer}`);

  // Use VNDC token as staking token
  const vndcDeployment = await deployments.get("MockStablecoin").catch(() => null);
  const stakingTokenAddress = vndcDeployment?.address || "0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48";

  console.log(`Staking Token: ${stakingTokenAddress}`);

  const stakingPoolDeployment = await deploy("StakingPool", {
    from: deployer,
    args: [stakingTokenAddress],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ StakingPool deployed at: ${stakingPoolDeployment.address}`);

  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    StakingPool: {
      address: stakingPoolDeployment.address,
      blockNumber: stakingPoolDeployment.blockNumber,
      transactionHash: stakingPoolDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 018 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["StakingPool", "018-staking"];
func.dependencies = [];

export default func;
