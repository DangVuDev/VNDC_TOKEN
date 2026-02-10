import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 014: Internship Management ==========");
  console.log(`Deployer: ${deployer}`);

  const internshipManagerDeployment = await deploy("InternshipManager", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ InternshipManager deployed at: ${internshipManagerDeployment.address}`);

  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    InternshipManager: {
      address: internshipManagerDeployment.address,
      blockNumber: internshipManagerDeployment.blockNumber,
      transactionHash: internshipManagerDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 014 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["Internship", "014"];
func.dependencies = [];

export default func;
