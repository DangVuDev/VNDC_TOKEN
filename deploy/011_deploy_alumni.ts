import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 011: Alumni Registry ==========");
  console.log(`Deployer: ${deployer}`);

  // Deploy AlumniRegistry
  const alumniRegistryDeployment = await deploy("AlumniRegistry", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ AlumniRegistry deployed at: ${alumniRegistryDeployment.address}`);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    AlumniRegistry: {
      address: alumniRegistryDeployment.address,
      blockNumber: alumniRegistryDeployment.blockNumber,
      transactionHash: alumniRegistryDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 011 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["Alumni", "011"];
func.dependencies = [];

export default func;
