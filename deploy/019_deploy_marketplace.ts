import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 019: Marketplace ==========");
  console.log(`Deployer: ${deployer}`);

  const marketplaceDeployment = await deploy("Marketplace", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ Marketplace deployed at: ${marketplaceDeployment.address}`);

  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    Marketplace: {
      address: marketplaceDeployment.address,
      blockNumber: marketplaceDeployment.blockNumber,
      transactionHash: marketplaceDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 019 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["Marketplace", "019"];
func.dependencies = [];

export default func;
