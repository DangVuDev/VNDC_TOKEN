import { ethers, deployments, getNamedAccounts } from "hardhat";
import { PaymentProcessor, MerchantRegistry } from "../typechain";

async function main() {
  const { deployer } = await getNamedAccounts();
  
  console.log("\n========== Deploying Module 005: Payment Processor ==========\n");
  console.log(`Deployer: ${deployer}`);

  // ============ Deploy PaymentProcessor ============
  console.log("\n[1/2] Deploying PaymentProcessor...");
  const paymentProcessorFactory = await ethers.getContractFactory("PaymentProcessor", deployer);
  const paymentProcessor = await paymentProcessorFactory.deploy();
  await paymentProcessor.waitForDeployment();
  const paymentProcessorAddress = await paymentProcessor.getAddress();
  console.log(`✓ PaymentProcessor deployed to: ${paymentProcessorAddress}`);

  // ============ Deploy MerchantRegistry ============
  console.log("\n[2/2] Deploying MerchantRegistry...");
  const merchantRegistryFactory = await ethers.getContractFactory("MerchantRegistry", deployer);
  const merchantRegistry = await merchantRegistryFactory.deploy();
  await merchantRegistry.waitForDeployment();
  const merchantRegistryAddress = await merchantRegistry.getAddress();
  console.log(`✓ MerchantRegistry deployed to: ${merchantRegistryAddress}`);

  // ============ Verify Deployments ============
  console.log("\n========== Deployment Summary ==========");
  console.log(`
PaymentProcessor:    ${paymentProcessorAddress}
MerchantRegistry:    ${merchantRegistryAddress}

Total contracts deployed: 2
Network: ${(await ethers.provider.getNetwork()).name}
Block: ${await ethers.provider.getBlockNumber()}
  `);

  // ============ Save Deployment Info ============
  const deploymentInfo = {
    module: "005-payment-processor",
    timestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name,
    deployer: deployer,
    contracts: {
      PaymentProcessor: paymentProcessorAddress,
      MerchantRegistry: merchantRegistryAddress
    }
  };

  console.log("\nDeployment info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
