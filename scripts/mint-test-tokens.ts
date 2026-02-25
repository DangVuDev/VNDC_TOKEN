import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const targetAddress = "0x7EFf82613404AE7Bce622EA1C927214E30F2285e";
  
  console.log("Minting tokens with deployer:", deployer.address);

  // VNDC Token
  const vndcAddr = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const vndc = await ethers.getContractAt(
    ["function mint(address to, uint256 amount)", "function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    vndcAddr
  );
  const decimals = await vndc.decimals();
  const amount = ethers.parseUnits("1000000", decimals);
  
  console.log(`Minting 1,000,000 VNDC to ${targetAddress}...`);
  const tx1 = await vndc.mint(targetAddress, amount);
  await tx1.wait();
  const bal = await vndc.balanceOf(targetAddress);
  console.log(`VNDC Balance: ${ethers.formatUnits(bal, decimals)} VNDC`);

  // Governance Token
  const govTokenAddr = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const govToken = await ethers.getContractAt(
    ["function mint(address to, uint256 amount)", "function balanceOf(address) view returns (uint256)"],
    govTokenAddr
  );
  console.log(`Minting 10,000 GOV tokens to ${targetAddress}...`);
  const tx2 = await govToken.mint(targetAddress, ethers.parseUnits("10000", 18));
  await tx2.wait();
  const govBal = await govToken.balanceOf(targetAddress);
  console.log(`GOV Balance: ${ethers.formatUnits(govBal, 18)}`);

  // Also mint to deployer for testing
  console.log(`Minting 5,000,000 VNDC to deployer ${deployer.address}...`);
  const tx3 = await vndc.mint(deployer.address, ethers.parseUnits("5000000", decimals));
  await tx3.wait();
  
  console.log("\n=== Minting Complete ===");
  console.log(`Target (${targetAddress}):`);
  console.log(`  VNDC: ${ethers.formatUnits(await vndc.balanceOf(targetAddress), decimals)}`);
  console.log(`  GOV: ${ethers.formatUnits(await govToken.balanceOf(targetAddress), 18)}`);
  console.log(`Deployer (${deployer.address}):`);
  console.log(`  VNDC: ${ethers.formatUnits(await vndc.balanceOf(deployer.address), decimals)}`);
}

main().catch(console.error);
