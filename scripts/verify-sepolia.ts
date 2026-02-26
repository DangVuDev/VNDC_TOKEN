import { run } from "hardhat";

/**
 * Verify all deployed contracts on Sepolia Etherscan
 */
async function main() {
  const contracts = [
    // ===== No constructor args =====
    { name: "VNDCRegistry", address: "0x7d16b0e9dC98a976F008f5606eE26Bba50FDe2c1", args: [] },
    { name: "AccessControl", address: "0x69d2F6cD1B6a3E4A273C003DcFf0CDA0CEb1cE65", args: [] },
    { name: "CredentialNFT", address: "0x706Ca9875Ca5bE5214413d1741c38976BBC38c71", args: [] },
    { name: "AcademicBadgeNFT", address: "0x78d380eeBe479660b37e772Db0404bE62D200851", args: [] },
    { name: "ActivityBadge", address: "0xf0756Abeea0a6DbC05651d0c2df63374aEBf2290", args: [] },
    { name: "PaymentProcessor", address: "0xe5AA2b90aC87F4271982E26e3D8Be46014f6b30e", args: [] },
    { name: "MerchantRegistry", address: "0x3e33EFe8cBBb65561d1253FEC9295833cF5D714c", args: [] },
    { name: "StudentRecordManager", address: "0x319EE1f8094c9fa5E39cB0643A90aDAC18f37bE2", args: [] },
    { name: "GovernanceToken", address: "0x8d05155aA9bAeD9862e44fa5697612B9a21eD2A7", args: [] },
    { name: "StudentDAO", address: "0x5eCF36478E3989705972775E1A443F53c7c43532", args: [] },
    { name: "StudentIDToken", address: "0xeeef6d62c071B31C02FA8234a704a3Db9341596F", args: [] },
    { name: "CertificationSystem", address: "0x5Ec6441A93ff6F505F779468F0bd12F79Ee03D40", args: [] },
    { name: "ScholarshipManager", address: "0x50Db8937caC9b1D254055438b398a409F9250E03", args: [] },
    { name: "AlumniRegistry", address: "0xC41EE8f2953d1c8aBa093a591857474a08716636", args: [] },
    { name: "ReputationBadgeSystem", address: "0x4C906f2bC9Cc6Fd0536DB3b6D9962C0819f79C4c", args: [] },
    { name: "JobBoard", address: "0xfB0E0143Fc5b83b9809aCa6ae7eD040568d1e116", args: [] },
    { name: "InternshipManager", address: "0xf41DC2c98852144ec0D7EcEF74D4256BaDdF4460", args: [] },
    { name: "ResearchCollaborationPlatform", address: "0x6e2B4a19c44623b63379c35F1643fc076765f936", args: [] },
    { name: "SmartContractAuditingSystem", address: "0x4AF9eAA67Dc5c5BC9B75f9F0e525aCcAE3A857f5", args: [] },
    { name: "DataMigrationAndIntegration", address: "0x3d1AD1ebdac6a86C692865C6B5C274EdB57e9445", args: [] },
    { name: "AnalyticsAndReportingDashboard", address: "0xb32B60D65f20c24d2885FC472D57A4439c4b3061", args: [] },

    // ===== With constructor args =====
    {
      name: "VNDC",
      address: "0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48",
      args: ["1000000000000000000000000000"], // 1 billion * 10^18
    },
    {
      name: "CredentialVerification",
      address: "0x2F73B53C805A90C1BB407726c704637C5dC19284",
      args: ["0x706Ca9875Ca5bE5214413d1741c38976BBC38c71"], // CredentialNFT address
    },
    {
      name: "AcademicReward",
      address: "0x59D093AF84dD99fe20817075C52527855b8dFB9b",
      args: [
        "0x78d380eeBe479660b37e772Db0404bE62D200851", // AcademicBadgeNFT
        "0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48", // VNDC
        "0x7d16b0e9dC98a976F008f5606eE26Bba50FDe2c1", // VNDCRegistry
      ],
    },
    {
      name: "ExtracurricularReward",
      address: "0x2ec4Cf8Abfb952Eb3d5844C72925Ebe9FBa70B9e",
      args: [
        "0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48", // VNDC
        "0xf0756Abeea0a6DbC05651d0c2df63374aEBf2290", // ActivityBadge
      ],
    },
  ];

  let verified = 0;
  let failed = 0;
  let alreadyVerified = 0;
  const failures: string[] = [];

  for (const contract of contracts) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`🔍 Verifying ${contract.name} at ${contract.address}...`);

    try {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args,
      });
      console.log(`✅ ${contract.name} verified!`);
      verified++;
    } catch (error: any) {
      const msg = error.message || String(error);
      if (msg.includes("Already Verified") || msg.includes("already verified")) {
        console.log(`⏭️  ${contract.name} already verified.`);
        alreadyVerified++;
      } else {
        console.log(`❌ ${contract.name} failed: ${msg}`);
        failures.push(`${contract.name}: ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 VERIFICATION SUMMARY`);
  console.log(`${"═".repeat(60)}`);
  console.log(`✅ Newly verified: ${verified}`);
  console.log(`⏭️  Already verified: ${alreadyVerified}`);
  console.log(`❌ Failed: ${failed}`);
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log(`${"═".repeat(60)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
