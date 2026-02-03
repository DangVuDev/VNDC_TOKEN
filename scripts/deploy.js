const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Deploying VNDC DApp Smart Contracts...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying contracts with account: ${deployer.address}\n`);

    const deployments = {};

    // ===== 1. Deploy VNDC Token =====
    console.log("1️⃣  Deploying VNDC_Token...");
    const VNDCToken = await hre.ethers.getContractFactory("VNDC_Token");
    const vndcToken = await VNDCToken.deploy(deployer.address);
    await vndcToken.deployed();
    deployments.VNDC_Token = vndcToken.address;
    console.log(`   ✅ VNDC_Token deployed to: ${vndcToken.address}\n`);

    // ===== 2. Deploy VNDC Credential =====
    console.log("2️⃣  Deploying VNDC_Credential...");
    const VNDCCredential = await hre.ethers.getContractFactory("VNDC_Credential");
    const vndcCredential = await VNDCCredential.deploy();
    await vndcCredential.deployed();
    deployments.VNDC_Credential = vndcCredential.address;
    console.log(`   ✅ VNDC_Credential deployed to: ${vndcCredential.address}\n`);

    // ===== 3. Deploy VNDC Rewards =====
    console.log("3️⃣  Deploying VNDC_Rewards...");
    const VNDCRewards = await hre.ethers.getContractFactory("VNDC_Rewards");
    const vndcRewards = await VNDCRewards.deploy(vndcToken.address);
    await vndcRewards.deployed();
    deployments.VNDC_Rewards = vndcRewards.address;
    console.log(`   ✅ VNDC_Rewards deployed to: ${vndcRewards.address}\n`);

    // ===== 4. Deploy VNDC Payments =====
    console.log("4️⃣  Deploying VNDC_Payments...");
    const VNDCPayments = await hre.ethers.getContractFactory("VNDC_Payments");
    const vndcPayments = await VNDCPayments.deploy(vndcToken.address);
    await vndcPayments.deployed();
    deployments.VNDC_Payments = vndcPayments.address;
    console.log(`   ✅ VNDC_Payments deployed to: ${vndcPayments.address}\n`);

    // ===== 5. Deploy VNDC Governance =====
    console.log("5️⃣  Deploying VNDC_Governance...");
    const VNDCGovernance = await hre.ethers.getContractFactory("VNDC_Governance");
    const vndcGovernance = await VNDCGovernance.deploy(vndcToken.address);
    await vndcGovernance.deployed();
    deployments.VNDC_Governance = vndcGovernance.address;
    console.log(`   ✅ VNDC_Governance deployed to: ${vndcGovernance.address}\n`);

    // ===== Save Deployment Addresses =====
    console.log("💾 Saving deployment addresses...\n");
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const networkName = hre.network.name;
    const deploymentFile = path.join(deploymentsDir, `${networkName}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
    console.log(`📝 Saved to: ${deploymentFile}\n`);

    // ===== Print Summary =====
    console.log("=" .repeat(60));
    console.log("DEPLOYMENT SUMMARY");
    console.log("=" .repeat(60));
    console.log(`Network: ${networkName}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`\nContract Addresses:`);
    console.log(`  VNDC_Token:       ${deployments.VNDC_Token}`);
    console.log(`  VNDC_Credential:  ${deployments.VNDC_Credential}`);
    console.log(`  VNDC_Rewards:     ${deployments.VNDC_Rewards}`);
    console.log(`  VNDC_Payments:    ${deployments.VNDC_Payments}`);
    console.log(`  VNDC_Governance:  ${deployments.VNDC_Governance}`);
    console.log("=" .repeat(60));

    console.log("\n✅ Deployment Complete!");
    console.log("\n📋 Next Steps:");
    console.log("1. Verify contracts on PolygonScan:");
    console.log(`   npx hardhat verify --network ${networkName} <ADDRESS> <ARGS>`);
    console.log("\n2. Setup roles:");
    console.log(`   npx hardhat run scripts/setup-roles.js --network ${networkName}`);
    console.log("\n3. Fund reward pool:");
    console.log(`   npx hardhat run scripts/fund-rewards.js --network ${networkName}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
