const hre = require("hardhat");

async function main() {
  const tokenAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const token = await hre.ethers.getContractAt("VNDCToken", tokenAddr);
  
  const totalSupply = await token.totalSupply();
  const maxSupply = await token.MAX_SUPPLY();
  
  console.log("Total Supply:", hre.ethers.formatUnits(totalSupply, 18), "VNDC");
  console.log("Max Supply:", hre.ethers.formatUnits(maxSupply, 18), "VNDC");
  console.log("Available to mint:", hre.ethers.formatUnits(maxSupply - totalSupply, 18), "VNDC");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
