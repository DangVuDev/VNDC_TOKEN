@echo off
REM VNDC Token - Phase 3 Project Initialization Script for Windows
REM This script sets up the complete environment for development and deployment

echo.
echo ================================================================
echo   VNDC Token - Phase 3 Smart Contracts Setup
echo ================================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    exit /b 1
)

echo [*] Checking environment...
for /f "tokens=*" %%i in ('node --version') do echo Node.js version: %%i
for /f "tokens=*" %%i in ('npm --version') do echo npm version: %%i
echo.

REM Step 1: Install dependencies
echo [*] Step 1: Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install dependencies
    exit /b 1
)
echo [+] Dependencies installed
echo.

REM Step 2: Compile contracts
echo [*] Step 2: Compiling contracts...
call npm run compile
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to compile contracts
    exit /b 1
)
echo [+] Contracts compiled
echo.

REM Step 3: Run tests
echo [*] Step 3: Running test suite...
call npm run test
if %ERRORLEVEL% NEQ 0 (
    echo Error: Tests failed
    exit /b 1
)
echo [+] All tests passed
echo.

REM Step 4: Environment setup
echo [*] Step 4: Checking environment configuration...
if exist .env (
    echo [+] .env file exists
) else (
    echo [!] .env file not found. Creating from template...
    (
        echo # Sepolia Testnet Configuration
        echo SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
        echo PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
        echo ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY_HERE
        echo.
        echo # Gas Reporter
        echo REPORT_GAS=false
        echo COINMARKETCAP_API_KEY=YOUR_COINMARKETCAP_API_KEY_HERE
    ) > .env
    echo [!] Please update .env with your credentials
)
echo.

REM Step 5: Display project structure
echo [*] Step 5: Project Structure
echo.
echo Smart Contracts:
echo   + contracts/VNDCToken.sol
echo   + contracts/VNDCStaking.sol
echo   + contracts/VNDCTokenVesting.sol
echo.
echo Test Suite (78 tests):
echo   + test/VNDCToken.test.ts
echo   + test/VNDCStaking.test.ts
echo   + test/VNDCTokenVesting.test.ts
echo.
echo Deployment:
echo   + scripts/deploy.ts
echo.
echo Documentation:
echo   + README.md
echo   + COMPLETION_REPORT.md
echo   + SEPOLIA_DEPLOYMENT_GUIDE.md
echo.

REM Step 6: Display next steps
echo ================================================================
echo [+] Project Setup Complete!
echo ================================================================
echo.
echo [*] Next Steps:
echo.
echo 1. Update .env with your Sepolia credentials:
echo    - PRIVATE_KEY: Your wallet private key
echo    - ETHERSCAN_API_KEY: Optional, for contract verification
echo.
echo 2. Deploy to Sepolia Testnet:
echo    npm run deploy:sepolia
echo.
echo 3. Verify on Etherscan (Optional):
echo    npx hardhat verify --network sepolia ^<ADDRESS^> ^<ARGS^>
echo.
echo 4. Frontend Integration:
echo    Use artifacts/ and typechain-types/ for contract interaction
echo.
echo [*] Documentation:
echo    * README.md - Quick start guide
echo    * COMPLETION_REPORT.md - Full project overview
echo    * SEPOLIA_DEPLOYMENT_GUIDE.md - Deployment walkthrough
echo.
echo [*] Useful Commands:
echo    npm run compile           - Compile all contracts
echo    npm run test             - Run all 78 tests
echo    npm run test:coverage    - Generate coverage report
echo    npm run deploy:localhost - Deploy to local node
echo    npm run deploy:sepolia   - Deploy to Sepolia testnet
echo    npm run node             - Start local Hardhat node
echo.
echo [+] Happy coding!
echo.
pause
