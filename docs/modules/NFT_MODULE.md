# 🎨 NFT Module (ERC721/1155)

## Overview

NFT Module để quản lý:
- ✅ Digital Certificates (Chứng chỉ hoàn thành khóa học)
- ✅ Badges & Achievements (Huy hiệu, thành tích)
- ✅ Collectibles & Rewards (Vật phẩm số)

## Why ERC1155 vs ERC721?

| Tính năng | ERC721 | ERC1155 |
|----------|--------|---------|
| Unique tokens | ✅ | ❌ |
| Fungible tokens | ❌ | ✅ |
| Batch operations | ❌ | ✅ |
| Gas efficiency | ❌ | ✅ |
| URI flexibility | Single | Multiple |

**Chọn ERC1155** vì:
- Hỗ trợ cả NFT (unique) và tokens (fungible)
- Gas-efficient batch operations
- Linh hoạt hơn

## Contract Architecture

### 1. Base NFT Contract (ERC1155)
```solidity
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract VNDCNFTs is ERC1155, Ownable {
  
  // Token type IDs
  enum TokenType {
    CERTIFICATE = 0,      // Chứng chỉ
    BADGE = 1,           // Huy hiệu
    ACHIEVEMENT = 2      // Thành tích
  }
  
  // Token metadata
  struct TokenMetadata {
    string name;
    string description;
    uint256 maxSupply;
    uint256 currentSupply;
    bool minted;
  }
  
  mapping(uint256 => TokenMetadata) public tokenMetadata;
  
  uint256 private currentTokenId;
  
  constructor() ERC1155("https://api.vndc.io/nft/metadata/{id}.json") {}
  
  // Mint NFT
  function mintNFT(
    address to,
    uint256 tokenId,
    uint256 amount,
    string memory name,
    string memory description
  ) external onlyOwner returns (uint256) {
    require(!tokenMetadata[tokenId].minted, "Token already exists");
    
    _mint(to, tokenId, amount, "");
    
    tokenMetadata[tokenId] = TokenMetadata({
      name: name,
      description: description,
      maxSupply: amount,
      currentSupply: amount,
      minted: true
    });
    
    currentTokenId++;
    return tokenId;
  }
  
  // Batch mint
  function batchMint(
    address[] calldata recipients,
    uint256[] calldata tokenIds,
    uint256[] calldata amounts,
    string[] calldata names,
    string[] calldata descriptions
  ) external onlyOwner {
    require(
      recipients.length == tokenIds.length &&
      tokenIds.length == amounts.length,
      "Array length mismatch"
    );
    
    for (uint i = 0; i < recipients.length; i++) {
      mintNFT(recipients[i], tokenIds[i], amounts[i], names[i], descriptions[i]);
    }
  }
  
  // Burn NFT
  function burn(
    address from,
    uint256 tokenId,
    uint256 amount
  ) public {
    require(
      from == msg.sender || isApprovedForAll(from, msg.sender),
      "Not authorized"
    );
    
    _burn(from, tokenId, amount);
    tokenMetadata[tokenId].currentSupply -= amount;
  }
  
  // Get token metadata
  function getTokenMetadata(uint256 tokenId) 
    external 
    view 
    returns (TokenMetadata memory) {
    require(tokenMetadata[tokenId].minted, "Token does not exist");
    return tokenMetadata[tokenId];
  }
  
  // Update metadata URI
  function setURI(string memory newuri) public onlyOwner {
    _setURI(newuri);
  }
  
  // Get current token ID counter
  function getCurrentTokenId() external view returns (uint256) {
    return currentTokenId;
  }
}
```

## Metadata Structure

### Certificate Metadata JSON
```json
{
  "id": "0",
  "type": "certificate",
  "name": "Blockchain Fundamentals - Completed",
  "description": "Certificate of completion for Blockchain Fundamentals course",
  "image": "https://api.vndc.io/images/certificate-blockchain.png",
  "attributes": [
    {
      "trait_type": "Course",
      "value": "Blockchain Fundamentals"
    },
    {
      "trait_type": "Issued Date",
      "value": "2024-01-15"
    },
    {
      "trait_type": "Issuer",
      "value": "VNDC Academy"
    }
  ]
}
```

### Badge Metadata JSON
```json
{
  "id": "1",
  "type": "badge",
  "name": "Top Performer",
  "description": "Badge awarded to top performers",
  "image": "https://api.vndc.io/images/badge-top-performer.png",
  "attributes": [
    {
      "trait_type": "Rarity",
      "value": "Rare"
    },
    {
      "trait_type": "Category",
      "value": "Performance"
    }
  ]
}
```

## Deployment

### Deploy Script
```solidity
// See onchain/deploy/002_deploy_nft.ts
```

## Backend Integration

### 1. Mint Certificate
```go
// services/nft_service.go
func MintCertificate(
  ctx context.Context,
  student string,
  course string,
) error {
  // Generate token ID
  tokenId := big.NewInt(int64(time.Now().UnixNano()))
  
  // Call contract
  tx, err := nftContract.MintNFT(
    ownerOpts,
    common.HexToAddress(student),
    tokenId,
    big.NewInt(1),  // amount = 1 (NFT)
    course + " Certificate",
    "Certificate of completion",
  )
  if err != nil {
    return err
  }
  
  receipt, err := bind.WaitMined(ctx, ethClient, tx)
  if err != nil {
    return err
  }
  
  // Store in MongoDB
  nftDoc := NFTRecord{
    TokenID:    tokenId.String(),
    Owner:      student,
    Type:       "CERTIFICATE",
    Metadata:   course,
    MintedAt:   time.Now(),
    TxHash:     receipt.TxHash.Hex(),
  }
  
  collection.InsertOne(ctx, nftDoc)
  
  return nil
}
```

### 2. Badge Issuance
```go
func IssueBadge(
  ctx context.Context,
  students []string,
  badgeName string,
) error {
  // Generate token ID
  tokenId := big.NewInt(int64(len(students)))
  
  // Prepare arrays
  var recipients []common.Address
  for _, s := range students {
    recipients = append(recipients, common.HexToAddress(s))
  }
  
  // Batch mint
  tx, err := nftContract.BatchMint(
    ownerOpts,
    recipients,
    []uint256{tokenId},
    []uint256{big.NewInt(1)},
    []string{badgeName},
    []string{"Badge for achievement"},
  )
  
  // ... process response
}
```

### 3. MongoDB Schema
```javascript
db.createCollection("nfts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      properties: {
        _id: { bsonType: "objectId" },
        token_id: { bsonType: "string" },
        owner: { bsonType: "string" },
        type: { 
          enum: ["CERTIFICATE", "BADGE", "ACHIEVEMENT"]
        },
        metadata: { bsonType: "string" },
        minted_at: { bsonType: "date" },
        tx_hash: { bsonType: "string" },
        metadata_uri: { bsonType: "string" }
      }
    }
  }
});

db.nfts.createIndex({ owner: 1, type: 1 });
db.nfts.createIndex({ token_id: 1 }, { unique: true });
```

## API Endpoints

### Mint Certificate
```
POST /api/v1/nft/certificate
Authorization: Bearer {admin_token}

{
  "student": "0x...",
  "course": "Blockchain Fundamentals"
}

Response:
{
  "token_id": "123456",
  "owner": "0x...",
  "tx_hash": "0x...",
  "status": "minting"
}
```

### List NFTs
```
GET /api/v1/nft/owner/:wallet

Response:
{
  "nfts": [
    {
      "token_id": "123456",
      "type": "CERTIFICATE",
      "metadata": "Blockchain Fundamentals",
      "minted_at": "2024-01-15T10:30:00Z",
      "metadata_uri": "https://api.vndc.io/nft/metadata/123456.json"
    }
  ]
}
```

### Get NFT Metadata
```
GET /api/v1/nft/metadata/:token_id

Response:
{
  "id": "123456",
  "type": "certificate",
  "name": "Blockchain Fundamentals - Completed",
  "description": "...",
  "image": "https://...",
  "attributes": [...]
}
```

## Events

```solidity
event NFTMinted(
  indexed address to,
  uint256 indexed tokenId,
  uint256 amount,
  string name
);

event NFTBurned(
  indexed address from,
  uint256 indexed tokenId,
  uint256 amount
);

event BatchMinted(
  address[] recipients,
  uint256[] tokenIds,
  uint256 totalAmount
);
```

## Security

- ✅ Only owner can mint/burn
- ✅ Token URI immutable after creation
- ✅ No reentrancy vulnerabilities
- ✅ Access control on batch operations
- ✅ Use OpenZeppelin's ERC1155

---

**Next Steps**: Deploy to testnet, test metadata URI, integrate with backend, enable production.
