import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 006: Records Management ==========\n");
  console.log(`Deployer: ${deployer}`);

  console.log("\n[1/1] Deploying StudentRecordManager...");
  const studentRecordManagerDeploy = await deploy("StudentRecordManager", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✓ StudentRecordManager deployed to: ${studentRecordManagerDeploy.address}`);

  console.log("\n========== Module 006 Deployment Summary ==========");
  console.log(`StudentRecordManager: ${studentRecordManagerDeploy.address}`);
};

func.tags = ["RecordsManagement", "006"];
func.dependencies = [];

export default func;
