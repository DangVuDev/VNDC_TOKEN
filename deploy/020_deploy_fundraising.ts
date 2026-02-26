import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Module 020: Fundraising ==========");
  console.log(`Deployer: ${deployer}`);

  // Use VNDC token as payment token
  const vndcDeployment = await deployments.get("MockStablecoin").catch(() => null);
  const paymentTokenAddress = vndcDeployment?.address || "0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48";

  console.log(`Payment Token: ${paymentTokenAddress}`);

  const fundraisingDeployment = await deploy("Fundraising", {
    from: deployer,
    args: [paymentTokenAddress],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  console.log(`\n✅ Fundraising deployed at: ${fundraisingDeployment.address}`);

  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    Fundraising: {
      address: fundraisingDeployment.address,
      blockNumber: fundraisingDeployment.blockNumber,
      transactionHash: fundraisingDeployment.transactionHash,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Module 020 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["Fundraising", "020-fundraising"];
func.dependencies = [];

export default func;
