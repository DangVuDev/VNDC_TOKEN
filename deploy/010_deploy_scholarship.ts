import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 010: Scholarship Management ==========");
  console.log(`Deployer: ${deployer}`);

  // Deploy ScholarshipManager
  const scholarshipManagerDeployment = await deploy("ScholarshipManager", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ ScholarshipManager deployed at: ${scholarshipManagerDeployment.address}`);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    ScholarshipManager: {
      address: scholarshipManagerDeployment.address,
      blockNumber: scholarshipManagerDeployment.blockNumber,
      transactionHash: scholarshipManagerDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 010 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["Scholarship", "010"];
func.dependencies = [];

export default func;
