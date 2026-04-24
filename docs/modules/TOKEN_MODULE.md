# 💰 Token Module (ERC20 - VNDC)

## Overview

VNDC Token là token ERC20 dùng để:
- ✅ Ghi nhận điểm tích lũy của học sinh
- ✅ Hỗ trợ giao dịch trong hệ thống
- ✅ Hỗ trợ Meta-Transaction (EIP-712)

## Contract Architecture

### 1. Base Contract
```solidity
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract VNDCToken is ERC20, Ownable {
  address public authorizedRelayer;
  
  mapping(address => uint256) public nonces;
  
  // EIP-712 Domain Separator
  bytes32 public domainSeparator;
  
  // Type Hash for meta-transaction
  bytes32 public constant TRANSFER_TYPEHASH = 
    keccak256("TransferData(address from,address to,uint256 amount,uint256 nonce)");
  
  constructor() ERC20("VNDC Token", "VNDC") {
    domainSeparator = calculateDomainSeparator();
  }
  
  function setRelayer(address _relayer) external onlyOwner {
    authorizedRelayer = _relayer;
  }
  
  // EIP-712 domain separator
  function calculateDomainSeparator() internal view returns (bytes32) {
    return keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256(bytes("VNDC Token")),
      keccak256(bytes("1")),
      block.chainid,
      address(this)
    ));
  }
  
  // Recover signer from signature
  function _recoverSigner(
    address from,
    address to,
    uint256 amount,
    uint256 nonce,
    bytes calldata signature
  ) internal view returns (address) {
    bytes32 structHash = keccak256(abi.encode(
      TRANSFER_TYPEHASH,
      from,
      to,
      amount,
      nonce
    ));
    
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainSeparator,
      structHash
    ));
    
    return ECDSA.recover(digest, signature);
  }
  
  // Meta-transaction transfer
  function transferWithSignature(
    address from,
    address to,
    uint256 amount,
    uint256 nonce,
    bytes calldata signature
  ) external returns (bool) {
    // Verify signature
    address signer = _recoverSigner(from, to, amount, nonce, signature);
    require(signer == from, "Invalid signature");
    
    // Check nonce
    require(nonce > nonces[from], "Invalid nonce");
    nonces[from] = nonce;
    
    // Transfer
    _transfer(from, to, amount);
    return true;
  }
  
  // Batch transfer (from Relayer)
  function batchTransfer(
    address[] calldata recipients,
    uint256[] calldata amounts,
    address[] calldata senders,
    uint256[] calldata nonces_,
    bytes[] calldata signatures
  ) external returns (bool) {
    require(msg.sender == authorizedRelayer, "Only relayer");
    require(recipients.length == amounts.length, "Array length mismatch");
    
    for (uint i = 0; i < recipients.length; i++) {
      // Verify signature
      address signer = _recoverSigner(
        senders[i],
        recipients[i],
        amounts[i],
        nonces_[i],
        signatures[i]
      );
      require(signer == senders[i], "Invalid signature");
      
      // Check nonce
      require(nonces_[i] > nonces[senders[i]], "Invalid nonce");
      nonces[senders[i]] = nonces_[i];
      
      // Transfer
      _transfer(senders[i], recipients[i], amounts[i]);
    }
    
    return true;
  }
  
  // Mint tokens (Admin only)
  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }
  
  // Get current nonce for address
  function getNonce(address user) external view returns (uint256) {
    return nonces[user];
  }
}
```

## Deployment

### Hardhat Configuration
See [onchain/hardhat.config.ts](../../onchain/hardhat.config.ts)

### Deploy Script
See [onchain/deploy/001_deploy_token.ts](../../onchain/deploy/001_deploy_token.ts)

## Testing

### Unit Tests
See [onchain/test/VNDCToken.test.ts](../../onchain/test/VNDCToken.test.ts)

Test cases:
- ✅ ERC20 standard functions (transfer, balanceOf, etc.)
- ✅ EIP-712 signature verification
- ✅ Nonce management
- ✅ Batch transfer
- ✅ Access control
- ✅ Edge cases (overflow, underflow, zero amounts)

## Integration with Backend

### 1. Contract Address Configuration
```go
// config/config.go
const (
  TokenContractAddress = "0x..." // Set after deployment
  TokenDecimals        = 18
  RelayerAddress       = "0x..." // Relayer wallet
)
```

### 2. Balance Sync
```go
// services/balance.go
func SyncBalanceFromBlockchain(wallet string) (*big.Int, error) {
  // Call balanceOf() on token contract
  balance, err := tokenContract.BalanceOf(nil, common.HexToAddress(wallet))
  if err != nil {
    return nil, err
  }
  
  // Update Redis cache
  redis.Set("balance:"+wallet, balance.String())
  
  return balance, nil
}
```

### 3. Batch Settlement
```go
// workers/batch_worker.go
func (w *BatchWorker) SubmitBatch(ctx context.Context, txs []Transaction) error {
  // Prepare arrays
  var recipients []common.Address
  var amounts []*big.Int
  var senders []common.Address
  var nonces []uint64
  var signatures [][]byte
  
  for _, tx := range txs {
    recipients = append(recipients, common.HexToAddress(tx.To))
    amount := new(big.Int).SetString(tx.Amount, 10)
    amounts = append(amounts, amount)
    senders = append(senders, common.HexToAddress(tx.From))
    nonces = append(nonces, tx.Nonce)
    sig, _ := hex.DecodeString(strings.TrimPrefix(tx.Signature, "0x"))
    signatures = append(signatures, sig)
  }
  
  // Call batchTransfer
  tx, err := w.tokenContract.BatchTransfer(
    w.relayerOpts,
    recipients,
    amounts,
    senders,
    nonces,
    signatures,
  )
  if err != nil {
    return err
  }
  
  // Wait for confirmation
  receipt, err := bind.WaitMined(ctx, w.ethClient, tx)
  if err != nil {
    return err
  }
  
  return nil
}
```

## Events

### Transfer Event
```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

### MetaTransactionExecuted (Custom)
```solidity
event MetaTransactionExecuted(
  address indexed from,
  address indexed to,
  uint256 amount,
  uint256 nonce
);
```

### BatchTransferExecuted (Custom)
```solidity
event BatchTransferExecuted(
  bytes32 indexed batchId,
  uint256 transactionCount,
  uint256 totalAmount
);
```

## Configuration

### Environment Variables
```bash
# .env
VNDC_TOKEN_ADDRESS=0x...
VNDC_TOKEN_DECIMALS=18
RELAYER_ADDRESS=0x...
RELAYER_PRIVATE_KEY=0x...
```

## Security

- ✅ Signature verification using EIP-712
- ✅ Nonce management to prevent replay attacks
- ✅ Access control for sensitive functions
- ✅ No reentrancy vulnerabilities
- ✅ Use OpenZeppelin's battle-tested ERC20

---

**Next Steps**: Deploy to testnet (Sepolia), test with backend, enable production.
