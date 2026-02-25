import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 005: Payment Processor ==========\n");
  console.log(`Deployer: ${deployer}`);

  console.log("\n[1/2] Deploying PaymentProcessor...");
  const paymentProcessorDeploy = await deploy("PaymentProcessor", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✓ PaymentProcessor deployed to: ${paymentProcessorDeploy.address}`);

  console.log("\n[2/2] Deploying MerchantRegistry...");
  const merchantRegistryDeploy = await deploy("MerchantRegistry", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✓ MerchantRegistry deployed to: ${merchantRegistryDeploy.address}`);

  console.log("\n========== Module 005 Deployment Summary ==========");
  console.log(`PaymentProcessor: ${paymentProcessorDeploy.address}`);
  console.log(`MerchantRegistry: ${merchantRegistryDeploy.address}`);
};

func.tags = ["PaymentProcessor", "005"];
func.dependencies = [];

export default func;
