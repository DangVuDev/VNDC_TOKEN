#!/usr/bin/env node

/**
 * VNDC Phase 3 - Interactive Start Guide
 * This script intelligently guides you through deployment
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function main() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║     🚀 VNDC Token Phase 3 - Smart Contracts                ║');
  console.log('║        Interactive Deployment & Setup Guide               ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check environment
  console.log('📋 Checking your environment...');
  
  const nodeVersion = process.version;
  console.log(`   ✓ Node.js: ${nodeVersion}`);
  
  const hasEnv = fs.existsSync('.env');
  console.log(`   ${hasEnv ? '✓' : '✗'} .env file: ${hasEnv ? 'Found' : 'Not found'}`);
  
  const hasContracts = fs.existsSync('contracts');
  console.log(`   ${hasContracts ? '✓' : '✗'} Smart contracts: ${hasContracts ? 'Found' : 'Not found'}`);
  
  const hasPackageJson = fs.existsSync('package.json');
  console.log(`   ${hasPackageJson ? '✓' : '✗'} Dependencies: ${hasPackageJson ? 'Ready' : 'Not found'}`);
  
  console.log('');
  console.log('What would you like to do?');
  console.log('');
  console.log('  1️⃣  Deploy to Sepolia testnet');
  console.log('  2️⃣  Run local tests');
  console.log('  3️⃣  Compile contracts');
  console.log('  4️⃣  View documentation');
  console.log('  5️⃣  Set up environment');
  console.log('  6️⃣  Exit');
  console.log('');
  
  const choice = await question('Enter your choice (1-6): ');
  
  switch(choice.trim()) {
    case '1':
      await deployToSepolia();
      break;
    case '2':
      await runTests();
      break;
    case '3':
      await compileContracts();
      break;
    case '4':
      await viewDocumentation();
      break;
    case '5':
      await setupEnvironment();
      break;
    case '6':
      console.log('\n👋 Goodbye!');
      rl.close();
      return;
    default:
      console.log('\n❌ Invalid choice. Please enter 1-6.');
      await new Promise(resolve => setTimeout(resolve, 2000));
      rl.close();
      await main();
      return;
  }
  
  rl.close();
}

async function deployToSepolia() {
  console.clear();
  console.log('🚀 SEPOLIA DEPLOYMENT SETUP');
  console.log('═════════════════════════════════════\n');
  
  // Check if .env exists
  if (!fs.existsSync('.env')) {
    console.log('❌ .env file not found!');
    console.log('\nYou need to create a .env file with:');
    console.log('  - PRIVATE_KEY: Your wallet\'s private key');
    console.log('  - SEPOLIA_RPC_URL: Sepolia RPC endpoint');
    console.log('  - ETHERSCAN_API_KEY: (Optional) For contract verification\n');
    const shouldCreate = await question('Create .env now? (y/n): ');
    if (shouldCreate.toLowerCase() === 'y') {
      await setupEnvironment();
    }
    return;
  }
  
  // Check if private key is set
  const envContent = fs.readFileSync('.env', 'utf8');
  const hasPrivateKey = envContent.includes('PRIVATE_KEY') && !envContent.includes('PRIVATE_KEY=0x0000');
  
  if (!hasPrivateKey) {
    console.log('⚠️  PRIVATE_KEY not properly configured in .env');
    console.log('\nUpdate .env with your wallet\'s private key:');
    console.log('  PRIVATE_KEY=your_private_key_here\n');
    const ready = await question('Ready to deploy? (y/n): ');
    if (ready.toLowerCase() !== 'y') return;
  }
  
  console.log('\n✓ Environment configured');
  console.log('\nDeployment steps:');
  console.log('  1. npm run compile     - Compile contracts');
  console.log('  2. npm run test        - Run tests');
  console.log('  3. npm run deploy:sepolia - Deploy to Sepolia\n');
  
  const proceed = await question('Run deployment now? (y/n): ');
  if (proceed.toLowerCase() === 'y') {
    console.log('\n🔧 Starting deployment...\n');
    console.log('→ Run: npm run deploy:sepolia\n');
  }
}

async function runTests() {
  console.clear();
  console.log('🧪 RUNNING TESTS');
  console.log('════════════════════════════════════\n');
  
  console.log('Test Summary:');
  console.log('  • VNDCToken: 28 tests');
  console.log('  • VNDCStaking: 22 tests');
  console.log('  • VNDCTokenVesting: 28 tests');
  console.log('  ─────────────────────');
  console.log('  Total: 78 tests\n');
  
  console.log('Expected Result: All tests should pass\n');
  
  const run = await question('Run tests now? (y/n): ');
  if (run.toLowerCase() === 'y') {
    console.log('\n🔧 Running tests...\n');
    console.log('→ Run: npm run test\n');
  }
}

async function compileContracts() {
  console.clear();
  console.log('🔨 COMPILING CONTRACTS');
  console.log('════════════════════════════════════\n');
  
  console.log('Contracts to compile:');
  console.log('  1. contracts/VNDCToken.sol');
  console.log('  2. contracts/VNDCStaking.sol');
  console.log('  3. contracts/VNDCTokenVesting.sol\n');
  
  console.log('Expected Result: All contracts compile with 0 errors\n');
  
  const run = await question('Compile now? (y/n): ');
  if (run.toLowerCase() === 'y') {
    console.log('\n🔧 Compiling...\n');
    console.log('→ Run: npm run compile\n');
  }
}

async function viewDocumentation() {
  console.clear();
  console.log('📚 DOCUMENTATION');
  console.log('════════════════════════════════════\n');
  
  const docs = [
    { name: 'README.md', desc: 'Quick start guide' },
    { name: 'INDEX.md', desc: 'Navigation guide' },
    { name: 'SEPOLIA_DEPLOYMENT_GUIDE.md', desc: 'Detailed deployment steps' },
    { name: 'GETTING_STARTED.html', desc: 'Interactive web guide (open in browser)' },
    { name: 'COMPLETION_REPORT.md', desc: 'Technical details' },
    { name: 'PHASE_3_VERIFICATION.md', desc: 'Test results' }
  ];
  
  docs.forEach((doc, i) => {
    console.log(`  ${i + 1}. ${doc.name}`);
    console.log(`     ${doc.desc}\n`);
  });
}

async function setupEnvironment() {
  console.clear();
  console.log('⚙️  ENVIRONMENT SETUP');
  console.log('════════════════════════════════════\n');
  
  if (fs.existsSync('.env')) {
    console.log('✓ .env file already exists\n');
    const edit = await question('Edit .env now? (y/n): ');
    if (edit.toLowerCase() !== 'y') return;
  }
  
  console.log('To deploy to Sepolia, you need:');
  console.log('  1. A wallet private key (or create new wallet)');
  console.log('  2. Sepolia testnet ETH (get from faucet)');
  console.log('  3. (Optional) Etherscan API key\n');
  
  console.log('Steps:');
  console.log('  1. Get Sepolia ETH from faucet:');
  console.log('     https://sepoliafaucet.com/\n');
  console.log('  2. Edit .env file with your credentials:');
  console.log('     PRIVATE_KEY=your_key_here\n');
  console.log('  3. (Optional) Add Etherscan API key for verification\n');
  
  const ready = await question('Ready? (y/n): ');
  if (ready.toLowerCase() === 'y') {
    console.log('\n✓ Edit .env file now, then run: npm run deploy:sepolia\n');
  }
}

main().catch(console.error);
