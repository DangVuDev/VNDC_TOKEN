import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 007: Governance System ==========\n");
  console.log(`Deployer: ${deployer}`);

  console.log("\n[1/2] Deploying GovernanceToken...");
  const governanceTokenDeploy = await deploy("GovernanceToken", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✓ GovernanceToken deployed to: ${governanceTokenDeploy.address}`);

  console.log("\n[2/2] Deploying StudentDAO...");
  const studentDAODeploy = await deploy("StudentDAO", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✓ StudentDAO deployed to: ${studentDAODeploy.address}`);

  console.log("\n========== Module 007 Deployment Summary ==========");
  console.log(`GovernanceToken: ${governanceTokenDeploy.address}`);
  console.log(`StudentDAO: ${studentDAODeploy.address}`);
};

func.tags = ["Governance", "007"];
func.dependencies = [];

export default func;
