#!/bin/bash
# VNDC Phase 3 - Quick Deploy Guide
# This guide gets you deployed to Sepolia in 5 minutes

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  VNDC Token Phase 3 - Quick Sepolia Deployment             ║"
echo "║  Estimated Time: 5 minutes                                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Prerequisites Check
echo "✓ STEP 1: Checking Prerequisites"
echo "  • Node.js installed: $(node --version)"
echo "  • npm installed: $(npm --version)"
echo ""

# Step 2: Environment Setup
echo "✓ STEP 2: Environment Configuration"
echo "  Required: Update .env file with:"
echo "  - PRIVATE_KEY: Your wallet's private key"
echo "  - SEPOLIA_RPC_URL: (optional - already configured)"
echo "  - ETHERSCAN_API_KEY: (optional - for verification)"
echo ""
echo "  Run this to edit .env:"
echo "  code .env          (VS Code)"
echo "  nano .env          (Terminal)"
echo ""

# Step 3: Verify Everything Works
echo "✓ STEP 3: Verify Local Setup"
echo "  Run these commands to verify:"
echo "  npm run compile    (should show: contracts compiled)"
echo "  npm run test       (should show: 78 passing)"
echo ""

# Step 4: Deploy
echo "✓ STEP 4: Deploy to Sepolia"
echo "  After updating .env, run:"
echo "  npm run deploy:sepolia"
echo ""
echo "  This will:"
echo "  • Compile all contracts"
echo "  • Deploy VNDCToken to Sepolia"
echo "  • Deploy VNDCStaking to Sepolia"
echo "  • Deploy VNDCTokenVesting to Sepolia"
echo "  • Output contract addresses"
echo ""

# Step 5: Verify Deployment
echo "✓ STEP 5: Verify on Etherscan"
echo "  After deployment, visit:"
echo "  https://sepolia.etherscan.io/"
echo "  Search for your contract addresses from Step 4"
echo ""

# Step 6: Optional - Verify Contracts
echo "✓ STEP 6: (Optional) Verify Contracts on Etherscan"
echo "  For full transparency, you can verify source code:"
echo "  npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <ARGS>"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Ready to Deploy? Follow Steps 1-6 above!                  ║"
echo "║  Questions? Check: README.md or SEPOLIA_DEPLOYMENT_GUIDE   ║"
echo "╚════════════════════════════════════════════════════════════╝"
