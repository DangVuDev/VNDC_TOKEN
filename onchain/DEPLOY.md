# 🚀 Deploy in 2 Minutes

## Step 1: Get Your Private Key
Copy your Sepolia wallet private key (starts with `0x`)

## Step 2: Configure
```bash
# Edit .env and replace the private key
PRIVATE_KEY=0x<paste-your-key-here>
```

## Step 3: Deploy
```bash
npm run deploy:sepolia
```

Done! Your contracts are live on Sepolia.

---

### Need testnet ETH?
Get it here: https://sepoliafaucet.com/

### Need a wallet?
Use MetaMask: https://metamask.io/

### What gets deployed?
- VNDCToken (ERC20 with advanced features)
- VNDCStaking (4-tier staking with rewards)
- VNDCTokenVesting (flexible vesting schedules)

### Verify everything works first
```bash
npm test  # Should show: 78 passing ✅
```
