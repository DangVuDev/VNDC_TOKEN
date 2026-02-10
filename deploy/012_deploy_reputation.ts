import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 012: Reputation & Badge System ==========");
  console.log(`Deployer: ${deployer}`);

  // Deploy ReputationBadgeSystem
  const reputationBadgeSystemDeployment = await deploy("ReputationBadgeSystem", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ ReputationBadgeSystem deployed at: ${reputationBadgeSystemDeployment.address}`);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    ReputationBadgeSystem: {
      address: reputationBadgeSystemDeployment.address,
      blockNumber: reputationBadgeSystemDeployment.blockNumber,
      transactionHash: reputationBadgeSystemDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 012 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["Reputation", "012"];
func.dependencies = [];

export default func;
