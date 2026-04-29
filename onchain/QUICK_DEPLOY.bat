@echo off
REM VNDC Phase 3 - Quick Deploy Guide (Windows)
REM This guide gets you deployed to Sepolia in 5 minutes

cls
echo.
echo ===============================================================
echo   VNDC Token Phase 3 - Quick Sepolia Deployment
echo   Estimated Time: 5 minutes
echo ===============================================================
echo.

REM Step 1: Prerequisites Check
echo [STEP 1] Checking Prerequisites
for /f "tokens=*" %%i in ('node --version') do echo   Node.js: %%i
for /f "tokens=*" %%i in ('npm --version') do echo   npm: %%i
echo.

REM Step 2: Environment Setup
echo [STEP 2] Environment Configuration
echo   Required: Update .env file with:
echo   - PRIVATE_KEY: Your wallet's private key
echo   - SEPOLIA_RPC_URL: (optional - already configured)
echo   - ETHERSCAN_API_KEY: (optional - for verification)
echo.
echo   Edit .env file now:
echo   - VS Code: code .env
echo   - Notepad: notepad .env
echo.

REM Step 3: Verify Everything Works
echo [STEP 3] Verify Local Setup
echo   Run these commands to verify:
echo   npm run compile    (should show: contracts compiled)
echo   npm run test       (should show: 78 passing)
echo.

REM Step 4: Deploy
echo [STEP 4] Deploy to Sepolia
echo   After updating .env, run:
echo   npm run deploy:sepolia
echo.
echo   This will:
echo   - Compile all contracts
echo   - Deploy VNDCToken to Sepolia
echo   - Deploy VNDCStaking to Sepolia
echo   - Deploy VNDCTokenVesting to Sepolia
echo   - Output contract addresses
echo.

REM Step 5: Verify Deployment
echo [STEP 5] Verify on Etherscan
echo   After deployment, visit:
echo   https://sepolia.etherscan.io/
echo   Search for your contract addresses from Step 4
echo.

REM Step 6: Optional - Verify Contracts
echo [STEP 6] (Optional) Verify Contracts on Etherscan
echo   For full transparency, you can verify source code:
echo   npx hardhat verify --network sepolia ^<ADDRESS^> ^<ARGS^>
echo.

echo ===============================================================
echo   Ready to Deploy? Follow Steps 1-6 above!
echo   Questions? Check: README.md or SEPOLIA_DEPLOYMENT_GUIDE.md
echo ===============================================================
echo.
pause
