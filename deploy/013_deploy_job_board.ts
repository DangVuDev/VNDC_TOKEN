import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 013: Job Board ==========");
  console.log(`Deployer: ${deployer}`);

  const jobBoardDeployment = await deploy("JobBoard", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ JobBoard deployed at: ${jobBoardDeployment.address}`);

  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    JobBoard: {
      address: jobBoardDeployment.address,
      blockNumber: jobBoardDeployment.blockNumber,
      transactionHash: jobBoardDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 013 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["JobBoard", "013"];
func.dependencies = [];

export default func;
