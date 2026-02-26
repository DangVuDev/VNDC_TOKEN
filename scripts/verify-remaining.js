/**
 * Verify contracts via Etherscan Standard JSON Input API V2
 * Used for contracts where bytecode non-determinism (viaIR) causes mismatch
 */
const fs = require("fs");
const https = require("https");

const ETHERSCAN_API_KEY = "XY5TIQ7GRB6IQUC8E5E1NVERF198446TPA";
const API_URL = "https://api.etherscan.io/v2/api";
const CHAIN_ID = 11155111;

const failedContracts = [
  {
    name: "CredentialNFT",
    address: "0x706Ca9875Ca5bE5214413d1741c38976BBC38c71",
    contractPath: "contracts/modules/002-credentials/CredentialNFT.sol:CredentialNFT",
    constructorArgs: "",
  },
  {
    name: "AcademicBadgeNFT",
    address: "0x78d380eeBe479660b37e772Db0404bE62D200851",
    contractPath: "contracts/modules/003-rewards-academic/AcademicBadgeNFT.sol:AcademicBadgeNFT",
    constructorArgs: "",
  },
  {
    name: "ActivityBadge",
    address: "0xf0756Abeea0a6DbC05651d0c2df63374aEBf2290",
    contractPath: "contracts/modules/004-rewards-extracurricular/ActivityBadge.sol:ActivityBadge",
    constructorArgs: "",
  },
];

function submitVerification(contract) {
  return new Promise((resolve, reject) => {
    // Load deployment artifact
    const deployment = JSON.parse(
      fs.readFileSync(`./deployments/sepolia/${contract.name}.json`, "utf8")
    );
    const solcInput = JSON.parse(
      fs.readFileSync(
        `./deployments/sepolia/solcInputs/${deployment.solcInputHash}.json`,
        "utf8"
      )
    );

    const postData = new URLSearchParams({
      apikey: ETHERSCAN_API_KEY,
      module: "contract",
      action: "verifysourcecode",
      contractaddress: contract.address,
      sourceCode: JSON.stringify(solcInput),
      codeformat: "solidity-standard-json-input",
      contractname: contract.contractPath,
      compilerversion: "v0.8.24+commit.e11b9ed9",
      constructorArguements: contract.constructorArgs,
    }).toString();

    const options = {
      hostname: "api.etherscan.io",
      path: `/v2/api?chainid=${CHAIN_ID}`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          resolve({ status: "0", result: data });
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function checkStatus(guid) {
  return new Promise((resolve, reject) => {
    const url = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${ETHERSCAN_API_KEY}`;

    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ status: "0", result: data });
          }
        });
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  for (const contract of failedContracts) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`🔍 Verifying ${contract.name} at ${contract.address}...`);

    try {
      const result = await submitVerification(contract);
      console.log("Submit response:", JSON.stringify(result));

      if (result.status === "1" || result.message === "OK") {
        const guid = result.result;
        console.log(`📝 GUID: ${guid}`);
        console.log("⏳ Waiting for verification...");

        // Poll for result
        for (let i = 0; i < 10; i++) {
          await sleep(5000);
          const status = await checkStatus(guid);
          console.log(`  Check ${i + 1}: ${status.result}`);

          if (
            status.result === "Pass - Verified" ||
            status.result?.includes("Already Verified")
          ) {
            console.log(`✅ ${contract.name} verified!`);
            break;
          }
          if (
            status.result !== "Pending in queue" &&
            !status.result?.includes("pending")
          ) {
            console.log(`❌ ${contract.name}: ${status.result}`);
            break;
          }
        }
      } else {
        console.log(`❌ Submit failed: ${result.result}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

main();
