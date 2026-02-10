import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 009: Certification System ==========");
  console.log(`Deployer: ${deployer}`);

  // Deploy CertificationSystem
  const certificationSystemDeployment = await deploy("CertificationSystem", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ CertificationSystem deployed at: ${certificationSystemDeployment.address}`);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    CertificationSystem: {
      address: certificationSystemDeployment.address,
      blockNumber: certificationSystemDeployment.blockNumber,
      transactionHash: certificationSystemDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 009 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["Certification", "009"];
func.dependencies = [];

export default func;
