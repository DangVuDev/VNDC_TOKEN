const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔐 Setting up contract roles...\n");

    const [deployer] = await hre.ethers.getSigners();
    const networkName = hre.network.name;

    // Load deployment addresses
    const deploymentFile = path.join(
        __dirname,
        `../deployments/${networkName}.json`
    );
    if (!fs.existsSync(deploymentFile)) {
        throw new Error(`Deployment file not found: ${deploymentFile}`);
    }

    const deployments = JSON.parse(fs.readFileSync(deploymentFile));
    console.log("Loaded deployment addresses:");
    console.log(`  VNDC_Token:       ${deployments.VNDC_Token}`);
    console.log(`  VNDC_Credential:  ${deployments.VNDC_Credential}`);
    console.log(`  VNDC_Rewards:     ${deployments.VNDC_Rewards}`);
    console.log(`  VNDC_Payments:    ${deployments.VNDC_Payments}`);
    console.log(`  VNDC_Governance:  ${deployments.VNDC_Governance}\n`);

    // Get contract instances
    const vndcToken = await hre.ethers.getContractAt(
        "VNDC_Token",
        deployments.VNDC_Token
    );
    const vndcCredential = await hre.ethers.getContractAt(
        "VNDC_Credential",
        deployments.VNDC_Credential
    );
    const vndcRewards = await hre.ethers.getContractAt(
        "VNDC_Rewards",
        deployments.VNDC_Rewards
    );
    const vndcPayments = await hre.ethers.getContractAt(
        "VNDC_Payments",
        deployments.VNDC_Payments
    );
    const vndcGovernance = await hre.ethers.getContractAt(
        "VNDC_Governance",
        deployments.VNDC_Governance
    );

    // Define roles
    const MINTER_ROLE = hre.ethers.id("MINTER_ROLE");
    const PAUSER_ROLE = hre.ethers.id("PAUSER_ROLE");
    const SNAPSHOT_ROLE = hre.ethers.id("SNAPSHOT_ROLE");
    const ISSUER_ROLE = hre.ethers.id("ISSUER_ROLE");
    const REVOKER_ROLE = hre.ethers.id("REVOKER_ROLE");
    const REWARD_ISSUER_ROLE = hre.ethers.id("REWARD_ISSUER_ROLE");
    const CLAIM_MANAGER_ROLE = hre.ethers.id("CLAIM_MANAGER_ROLE");
    const ADMIN_ROLE = hre.ethers.id("ADMIN_ROLE");
    const MERCHANT_ROLE = hre.ethers.id("MERCHANT_ROLE");
    const SETTLEMENT_ROLE = hre.ethers.id("SETTLEMENT_ROLE");
    const PROPOSER_ROLE = hre.ethers.id("PROPOSER_ROLE");

    console.log("=" .repeat(60));
    console.log("Setting up roles for deployer account...");
    console.log("=" .repeat(60));

    // Setup VNDC_Token roles
    console.log("\n📝 VNDC_Token Roles:");
    let tx = await vndcToken.grantRole(MINTER_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ MINTER_ROLE granted");

    tx = await vndcToken.grantRole(PAUSER_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ PAUSER_ROLE granted");

    tx = await vndcToken.grantRole(SNAPSHOT_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ SNAPSHOT_ROLE granted");

    // Setup VNDC_Credential roles
    console.log("\n📝 VNDC_Credential Roles:");
    tx = await vndcCredential.grantRole(ISSUER_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ ISSUER_ROLE granted");

    tx = await vndcCredential.grantRole(REVOKER_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ REVOKER_ROLE granted");

    // Setup VNDC_Rewards roles
    console.log("\n📝 VNDC_Rewards Roles:");
    tx = await vndcRewards.grantRole(ADMIN_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ ADMIN_ROLE granted");

    tx = await vndcRewards.grantRole(REWARD_ISSUER_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ REWARD_ISSUER_ROLE granted");

    tx = await vndcRewards.grantRole(CLAIM_MANAGER_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ CLAIM_MANAGER_ROLE granted");

    // Setup VNDC_Payments roles
    console.log("\n📝 VNDC_Payments Roles:");
    tx = await vndcPayments.grantRole(ADMIN_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ ADMIN_ROLE granted");

    tx = await vndcPayments.grantRole(MERCHANT_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ MERCHANT_ROLE granted");

    tx = await vndcPayments.grantRole(SETTLEMENT_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ SETTLEMENT_ROLE granted");

    // Setup VNDC_Governance roles
    console.log("\n📝 VNDC_Governance Roles:");
    tx = await vndcGovernance.grantRole(PROPOSER_ROLE, deployer.address);
    await tx.wait();
    console.log("   ✅ PROPOSER_ROLE granted");

    console.log("\n" + "=" .repeat(60));
    console.log("✅ All roles setup complete!");
    console.log("=" .repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
