#!/bin/bash

# VNDC Token - Phase 3 Project Initialization Script
# This script sets up the complete environment for development and deployment

echo "════════════════════════════════════════════════════════════"
echo "  VNDC Token - Phase 3 Smart Contracts Setup"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Checking environment...${NC}"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Step 1: Install dependencies
echo -e "${BLUE}📦 Step 1: Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 2: Compile contracts
echo -e "${BLUE}📦 Step 2: Compiling contracts...${NC}"
npm run compile
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to compile contracts${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Contracts compiled${NC}"
echo ""

# Step 3: Run tests
echo -e "${BLUE}📦 Step 3: Running test suite...${NC}"
npm run test
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All tests passed${NC}"
echo ""

# Step 4: Environment setup
echo -e "${BLUE}📦 Step 4: Checking environment configuration...${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
else
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    cp .env.example .env 2>/dev/null || cat > .env << 'EOF'
# Sepolia Testnet Configuration
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY_HERE

# Gas Reporter
REPORT_GAS=false
COINMARKETCAP_API_KEY=YOUR_COINMARKETCAP_API_KEY_HERE
EOF
    echo -e "${YELLOW}⚠️  Please update .env with your credentials${NC}"
fi
echo ""

# Step 5: Display project structure
echo -e "${BLUE}📦 Step 5: Project Structure${NC}"
echo "Smart Contracts:"
echo "  ✓ contracts/VNDCToken.sol (ERC20 Token)"
echo "  ✓ contracts/VNDCStaking.sol (Staking with Rewards)"
echo "  ✓ contracts/VNDCTokenVesting.sol (Token Vesting)"
echo ""
echo "Test Suite (78 tests):"
echo "  ✓ test/VNDCToken.test.ts (28 tests)"
echo "  ✓ test/VNDCStaking.test.ts (22 tests)"
echo "  ✓ test/VNDCTokenVesting.test.ts (28 tests)"
echo ""
echo "Deployment:"
echo "  ✓ scripts/deploy.ts (Automated deployment)"
echo ""
echo "Documentation:"
echo "  ✓ README.md (Quick start guide)"
echo "  ✓ COMPLETION_REPORT.md (Full project summary)"
echo "  ✓ SEPOLIA_DEPLOYMENT_GUIDE.md (Deployment instructions)"
echo ""

# Step 6: Display next steps
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Project Setup Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo ""
echo "1. Update .env with your Sepolia credentials:"
echo "   - PRIVATE_KEY: Your wallet private key"
echo "   - ETHERSCAN_API_KEY: (Optional) For contract verification"
echo ""
echo "2. Deploy to Sepolia Testnet:"
echo "   npm run deploy:sepolia"
echo ""
echo "3. Verify on Etherscan (Optional):"
echo "   npx hardhat verify --network sepolia <ADDRESS> <ARGS>"
echo ""
echo "4. Frontend Integration:"
echo "   Use artifacts/ and typechain-types/ for contract interaction"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "  • README.md - Quick start guide"
echo "  • COMPLETION_REPORT.md - Full project overview"
echo "  • SEPOLIA_DEPLOYMENT_GUIDE.md - Deployment walkthrough"
echo ""
echo -e "${YELLOW}🧪 Useful Commands:${NC}"
echo "  npm run compile           - Compile all contracts"
echo "  npm run test             - Run all 78 tests"
echo "  npm run test:coverage    - Generate coverage report"
echo "  npm run deploy:localhost - Deploy to local node"
echo "  npm run deploy:sepolia   - Deploy to Sepolia testnet"
echo "  npm run node             - Start local Hardhat node"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
