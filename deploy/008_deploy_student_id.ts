import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 008: Student ID ==========");
  console.log(`Deployer: ${deployer}`);

  // Deploy StudentIDToken
  const studentIDTokenDeployment = await deploy("StudentIDToken", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ StudentIDToken deployed at: ${studentIDTokenDeployment.address}`);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    StudentIDToken: {
      address: studentIDTokenDeployment.address,
      blockNumber: studentIDTokenDeployment.blockNumber,
      transactionHash: studentIDTokenDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 008 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["StudentID", "008"];
func.dependencies = [];

export default func;
