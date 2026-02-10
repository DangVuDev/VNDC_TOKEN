import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n========== Deploying Modules 015-018 ==========");
  console.log(`Deployer: ${deployer}`);

  // Module 015: Research
  const research = await deploy("ResearchCollaborationPlatform", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✅ ResearchCollaborationPlatform: ${research.address}`);

  // Module 016: Auditing
  const auditing = await deploy("SmartContractAuditingSystem", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✅ SmartContractAuditingSystem: ${auditing.address}`);

  // Module 017: Integration
  const integration = await deploy("DataMigrationAndIntegration", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✅ DataMigrationAndIntegration: ${integration.address}`);

  // Module 018: Analytics
  const analytics = await deploy("AnalyticsAndReportingDashboard", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
  console.log(`✅ AnalyticsAndReportingDashboard: ${analytics.address}`);

  const deploymentInfo = {
    network: hre.network.name,
    deployer,
    modules: {
      "015-Research": research.address,
      "016-Auditing": auditing.address,
      "017-Integration": integration.address,
      "018-Analytics": analytics.address,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========== Modules 015-018 Deployment Summary ==========");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["Research", "Auditing", "Integration", "Analytics", "015", "016", "017", "018"];
func.dependencies = [];

export default func;
