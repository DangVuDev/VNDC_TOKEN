import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy: hardhatDeploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("========== Deploying Module 002: Credentials ==========");
  log(`Network: ${network.name}`);
  log(`Deployer: ${deployer}`);

  try {
    // ============ Deploy CredentialNFT ============
    log("\n1. Deploying CredentialNFT contract...");
    const nftDeploy = await hardhatDeploy("CredentialNFT", {
      from: deployer,
      args: [],
      log: true,
      waitConfirmations: network.name === "localhost" ? 0 : 3,
    });

    const nftAddress = nftDeploy.address;
    log(`✓ CredentialNFT deployed to: ${nftAddress}`);

    // ============ Deploy CredentialVerification ============
    log("\n2. Deploying CredentialVerification contract...");
    const verificationDeploy = await hardhatDeploy("CredentialVerification", {
      from: deployer,
      args: [nftAddress],
      log: true,
      waitConfirmations: network.name === "localhost" ? 0 : 3,
    });

    const verificationAddress = verificationDeploy.address;
    log(`✓ CredentialVerification deployed to: ${verificationAddress}`);

    // ============ Post-Deployment Setup ============
    log("\n3. Setting up permissions...");

    // Get contract instances
    const nft = await ethers.getContractAt("CredentialNFT", nftAddress);
    const verification = await ethers.getContractAt(
      "CredentialVerification",
      verificationAddress
    );

    // Transfer NFT ownership to CredentialVerification contract
    let tx = await nft.transferOwnership(verificationAddress);
    await tx.wait();
    log(`✓ NFT contract ownership transferred to CredentialVerification`);

    // ============ Verification ============
    log("\n4. Verifying deployment...");

    // Verify NFT properties
    const nftName = await nft.name();
    const nftSymbol = await nft.symbol();
    log(`✓ NFT Name: ${nftName}`);
    log(`✓ NFT Symbol: ${nftSymbol}`);

    // Verify CredentialVerification
    const nftContractAddress = await verification.nftContract();
    const isDeployerIssuer = await verification.isIssuer(deployer);
    log(`✓ Verification contract linked to NFT: ${nftContractAddress}`);
    log(`✓ Deployer is issuer: ${isDeployerIssuer}`);

    // ============ Deployment Summary ============
    log("\n========== Deployment Complete ==========");
    log("\nDeployed Contracts:");
    log(`- CredentialNFT: ${nftAddress}`);
    log(`- CredentialVerification: ${verificationAddress}`);

    // Gas usage if deployment provided gas report
    if (nftDeploy.receipt) {
      log(`\nGas Used - CredentialNFT: ${nftDeploy.receipt.gasUsed}`);
    }
    if (verificationDeploy.receipt) {
      log(`Gas Used - CredentialVerification: ${verificationDeploy.receipt.gasUsed}`);
    }

    // Save deployment addresses
    const deploymentAddresses = {
      nft: nftAddress,
      verification: verificationAddress,
      deployedAt: new Date().toISOString(),
      network: network.name,
    };

    log("\nDeployment Summary:");
    log(JSON.stringify(deploymentAddresses, null, 2));

    return deploymentAddresses;
  } catch (error) {
    log(`❌ Deployment failed: ${error}`);
    throw error;
  }
};

deploy.tags = ["credentials", "module-002"];
deploy.dependencies = [] as any; // No dependencies on other modules for initial setup

export default deploy;
