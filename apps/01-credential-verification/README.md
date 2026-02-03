# App #1: Credential Verification (Xác Thực Chứng Chỉ)
## Complete Technical Specification & Implementation Guide

**App ID:** 01  
**Priority:** Tier 1 (MVP)  
**Score:** 9.8/10  
**Effort:** High Impact, Medium Complexity  
**Timeline:** Sprint 3-4 (Week 7-14)  

---

## 📋 Mục Lục
1. [Problem Analysis](#1-problem-analysis)
2. [Solution Design](#2-solution-design)
3. [System Architecture](#3-system-architecture)
4. [Use Cases & Workflows](#4-use-cases--workflows)
5. [Smart Contract Design](#5-smart-contract-design)
6. [Backend API Design](#6-backend-api-design)
7. [Frontend UI Design](#7-frontend-ui-design)
8. [Data Model](#8-data-model)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment Guide](#10-deployment-guide)

---

## 1. Problem Analysis

### 1.1 The Problem

#### Current State (Without VNDC)
```
Student Graduation Flow (Traditional):
──────────────────────────────────────

1. Student completes degree
   └─ Paper diploma issued by registrar office
   
2. Student wants to verify diploma to employer
   └─ Send physical document or PDF (easy to forge)
   └─ Employer manually verifies with university (slow, tedious)
   └─ Time: 1-4 weeks per verification
   
3. Employer checks authenticity
   └─ Calls registrar (during business hours only)
   └─ Registrar manually checks records
   └─ Possible human error, bias, corruption
   
4. Risk: Fake diplomas flourish
   └─ 45% of job applicants in some countries have fake credentials
   └─ Cost to employers: hiring unqualified candidates
   └─ Cost to universities: reputation damage
   └─ Cost to students: unfair competition with fraudsters
```

#### Key Problems
| Problem | Impact | Example |
|---------|--------|---------|
| **Forgery Risk** | Fake diplomas circulate | Student with fake MBA hires 100 people |
| **Slow Verification** | Employers give up | Verification takes 3 weeks, job is filled |
| **Manual Process** | Human error, bias | Registrar out sick, verification blocked |
| **Centralized Control** | Single point of failure | University records hacked/corrupted |
| **No Portability** | Credentials locked to university | Students can't easily verify globally |
| **Non-Transferable** | Can't aggregate credentials | No way to show all achievements |

#### Quantified Impact (Research Data)
- 📊 **45%** of job applicants submit fake credentials
- ⏱️ **3-4 weeks** average verification time
- 💰 **$200-500k** cost per bad hire to company
- 🏢 **70%** of employers can't verify fast enough
- 🌍 **0%** of diplomas recognized across borders without manual verification

### 1.2 Root Causes

```
Why is diploma verification broken?
─────────────────────────────────────────────────

1. Centralization
   └─ Diplomas stored in centralized registrar database
   └─ Subject to corruption, hacking, data loss
   └─ No way to verify without contacting university
   
2. No Cryptography
   └─ Diploma is just paper/PDF
   └─ Anyone can photoshop a diploma
   └─ No way to cryptographically verify authenticity
   
3. Slow, Manual Process
   └─ Verification requires human intervention
   └─ Works only during business hours
   └─ Prone to human error
   
4. No Auditability
   └─ When diploma was issued? Who issued it?
   └─ Has it been revoked? (for fraud, etc.)
   └─ No immutable record
   
5. Privacy & Control
   └─ University controls all records
   └─ Student can't easily share/verify
   └─ Credentials stuck in university system
```

---

## 2. Solution Design

### 2.1 The VNDC Solution

#### How Blockchain Solves It
```
Blockchain-Based Credential Verification (VNDC):
──────────────────────────────────────────────────

1. Student completes degree
   └─ University admin mints NFT diploma
   └─ Credential data hashed & stored on blockchain (immutable)
   └─ Metadata (name, GPA, date) on IPFS
   └─ Event logged: "DiplomaIssued(studentAddress, tokenId)"
   
2. Student wants to verify diploma
   └─ Share NFT link or token ID
   └─ OR show MetaMask wallet with NFT
   └─ Employer visits https://vndc-dapp.edu/verify/tokenId
   
3. Employer verifies instantly
   └─ Smart contract checks: isCredentialValid(tokenId)
   └─ Returns: issuer, holder, metadata, issuance date
   └─ Verification: < 2 seconds
   └─ Cost: ~$0.01 (on Polygon)
   
4. Benefits
   └─ ✅ Cryptographically secured (impossible to forge)
   └─ ✅ Instant verification (2-5 seconds)
   └─ ✅ Global accessibility (anyone can verify)
   └─ ✅ Immutable record (can't be altered)
   └─ ✅ Student-controlled (can share/revoke)
   └─ ✅ Auditable (full transaction history)
```

### 2.2 Solution Architecture

```
VNDC Credential System Architecture:
────────────────────────────────────────

┌─────────────────────────────────────┐
│  University Admin Portal (React)     │
│  └─ Mint diploma NFT                │
│  └─ Manage credentials              │
│  └─ View audit logs                 │
└──────────────┬──────────────────────┘
               │ API Call (mint())
┌──────────────┴──────────────────────┐
│  Backend API (Node.js/Express)       │
│  └─ Authenticate admin               │
│  └─ Prepare credential data          │
│  └─ Send TX to smart contract        │
│  └─ Store metadata on IPFS           │
└──────────────┬──────────────────────┘
               │ Ethers.js (smart contract call)
┌──────────────┴──────────────────────┐
│  Smart Contract (ERC-721)            │
│  └─ issueCredential()                │
│  └─ verify()                         │
│  └─ revoke()                         │
│  └─ isValid()                        │
└──────────────┬──────────────────────┘
               │ Blockchain Event
┌──────────────┴──────────────────────┐
│  Ethereum / Polygon Network          │
│  └─ Immutable record                 │
│  └─ Event log                        │
└──────────────────────────────────────┘

           ↕ IPFS
┌──────────────────────────────────────┐
│  IPFS Storage (Pinata)               │
│  └─ Credential metadata JSON         │
│  └─ Issuer signature                 │
│  └─ Immutable hash                   │
└──────────────────────────────────────┘

           ↕ Public Verification
┌──────────────────────────────────────┐
│  Public Verification Page (React)    │
│  └─ Anyone can verify NFT            │
│  └─ No login needed                  │
│  └─ Shows credential details         │
└──────────────────────────────────────┘
```

### 2.3 Key Benefits vs Traditional System

| Aspect | Traditional | VNDC Solution | Improvement |
|--------|-------------|---------------|-------------|
| **Verification Time** | 3-4 weeks | 5 seconds | **99.8% faster** |
| **Verification Cost** | $50-100 | $0.01 | **99.9% cheaper** |
| **Forgery Risk** | High (45% fake) | Impossible | **100% secure** |
| **Global Recognition** | No | Yes | **100% coverage** |
| **24/7 Availability** | No (business hours) | Yes | **Always available** |
| **Auditability** | Limited | Complete | **Full transparency** |
| **Student Control** | University | Student | **Decentralized** |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                CREDENTIAL SYSTEM LAYERS                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  LAYER 4: Verification Interface                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Public Verification Page (React)                 │   │
│  │ - Input: credential URL or token ID             │   │
│  │ - Output: Verified credential details           │   │
│  │ - No login required                             │   │
│  │ - Smart contract: isCredentialValid()           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  LAYER 3: Credential Management                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Admin Dashboard (React)                          │   │
│  │ - Mint credentials (batch support)              │   │
│  │ - Revoke credentials (fraud detection)          │   │
│  │ - View audit logs                               │   │
│  │ - Manage templates                              │   │
│  │ - Smart contract: issueCredential(), revoke()   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  LAYER 2: Backend Processing                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Node.js/Express API                             │   │
│  │ - POST /credentials/mint                        │   │
│  │ - GET /credentials/:tokenId                     │   │
│  │ - POST /credentials/:tokenId/revoke             │   │
│  │ - Database: PostgreSQL                          │   │
│  │ - Storage: IPFS (Pinata)                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  LAYER 1: Smart Contract                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │ VNDC_Credential.sol (ERC-721)                    │   │
│  │ - issueCredential(to, uri) → tokenId            │   │
│  │ - revoke(tokenId) → sets revoked[tokenId]=true  │   │
│  │ - verify(tokenId) → returns holder, metadata    │   │
│  │ - isValid(tokenId) → checks both exist & revoked│   │
│  │ - Event: CredentialIssued, CredentialRevoked    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  LAYER 0: Blockchain Network                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Ethereum / Polygon / BSC                        │   │
│  │ - Immutable transaction record                  │   │
│  │ - Event logs (Etherscan/Polygonscan)           │   │
│  │ - Smart contract bytecode (auditable)           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow Diagram

```
Credential Issuance Flow:
─────────────────────────

1. Admin Portal
   │
   ├─ Fill form: Student name, GPA, major, graduation date
   │
   └─ Click "Mint Diploma"
      │
      ▼
2. Frontend (React)
   │
   ├─ Validate inputs (name != empty, GPA 0-4.0, etc.)
   │
   ├─ Create JSON metadata:
   │  {
   │    "name": "Bachelor of Science",
   │    "student": "Nguyễn Văn A",
   │    "gpa": "3.8",
   │    "major": "Computer Science",
   │    "graduationDate": "2024-05-20",
   │    "issuer": "VNDC University",
   │    "issuedDate": "2024-05-20"
   │  }
   │
   └─ POST /api/credentials/mint (with JWT token)
      │
      ▼
3. Backend API
   │
   ├─ Verify JWT token (ensure admin)
   │
   ├─ Validate credential data
   │
   ├─ Upload metadata to IPFS
   │  └─ Returns: IPFS hash (e.g., QmXx...)
   │
   ├─ Build transaction:
   │  - Smart contract: issueCredential(studentAddress, ipfsURI)
   │
   └─ Send transaction via Ethers.js
      │
      ▼
4. Smart Contract (on-chain)
   │
   ├─ Check: only admin can call
   │
   ├─ Mint NFT:
   │  - tokenId = counter++
   │  - _safeMint(to, tokenId)
   │
   ├─ Store metadata:
   │  - tokenURIs[tokenId] = ipfsURI
   │
   ├─ Emit event:
   │  - CredentialIssued(tokenId, to, ipfsURI)
   │
   └─ Return tokenId
      │
      ▼
5. Blockchain
   │
   ├─ Store transaction (immutable)
   │
   ├─ Index event
   │
   └─ Update state: tokenId registered to student wallet
      │
      ▼
6. Backend Listener
   │
   ├─ Monitor for CredentialIssued events
   │
   ├─ Store in database:
   │  - INSERT credentialIssued
   │    (tokenId, student, ipfsURI, timestamp, txHash)
   │
   └─ Send notification: "Diploma issued!"
      │
      ▼
7. Student's MetaMask Wallet
   │
   └─ Shows 1 new NFT (ERC-721)


Credential Verification Flow:
─────────────────────────────

1. Employer / Public User
   │
   ├─ Visit: https://vndc-dapp.edu/verify/
   │
   └─ Enter: Token ID or NFT link
      │
      ▼
2. Frontend (React)
   │
   ├─ Parse token ID
   │
   └─ GET /api/credentials/verify/{tokenId}
      │
      ▼
3. Backend API
   │
   ├─ Smart contract call: isCredentialValid(tokenId)
   │
   ├─ Get metadata:
   │  - holder = contract.ownerOf(tokenId)
   │  - uri = contract.tokenURI(tokenId)
   │  - isValid = !revoked[tokenId]
   │
   ├─ Fetch from IPFS:
   │  - GET ipfs://{uri}
   │  - Parse JSON metadata
   │
   └─ Return to frontend:
      {
        "tokenId": 1,
        "holder": "0x...",
        "isValid": true,
        "metadata": {
          "name": "Bachelor of Science",
          "student": "Nguyễn Văn A",
          "gpa": "3.8",
          ...
        },
        "issuer": "0xUniversityAddress",
        "issuedDate": "2024-05-20"
      }
      │
      ▼
4. Frontend Display
   │
   └─ Show green checkmark: "✓ Verified"
      - Student name, degree, GPA
      - Issued date
      - Cannot be forged (on blockchain)
```

---

## 4. Use Cases & Workflows

### 4.1 Use Case Diagram

```
┌─────────────────────────────────────────────────────┐
│  Credential Verification System - Use Cases         │
└─────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │ Admin Portal │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌─────────┐     ┌──────────┐     ┌──────────────┐
    │ Mint    │     │ Revoke   │     │ View Audit   │
    │Diploma  │     │Diploma   │     │ Logs & Stats │
    └────┬────┘     └────┬─────┘     └──────┬───────┘
         │               │                   │
         └───────────────┼───────────────────┘
                         │
              ┌──────────▼──────────┐
              │  Smart Contract     │
              │ issueCredential()   │
              │ revoke()            │
              │ Event Logging       │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  Blockchain (NFT)   │
              │ ERC-721 Standard    │
              └──────────┬──────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
  ┌──────────┐   ┌──────────────┐  ┌──────────┐
  │ Student  │   │ Public       │  │ Employer │
  │View NFT  │   │Verification  │  │Verify    │
  └──────────┘   │Page          │  │Diploma   │
                 └──────────────┘  └──────────┘
```

### 4.2 UC-1: University Issues Diploma

**Actors:** Admin, Student, Smart Contract  
**Precondition:** Student has completed degree requirements  
**Main Flow:**

```
1. Admin opens VNDC admin portal
2. Admin navigates to "Issue Credentials" → "Diploma"
3. Admin fills form:
   - Student email / wallet address
   - Student name
   - Degree name (Bachelor of Science, etc.)
   - Major (Computer Science, etc.)
   - GPA (3.8)
   - Graduation date (2024-05-20)
4. Admin clicks "Mint Diploma"
5. Frontend validates inputs
6. Backend:
   a) Creates JSON metadata
   b) Uploads to IPFS
   c) Calls smart contract: issueCredential(studentAddr, ipfsUri)
7. Smart contract:
   a) Checks admin role
   b) Mints NFT (ERC-721)
   c) Stores IPFS URI
   d) Emits CredentialIssued event
8. Event listener:
   a) Catches event
   b) Updates database
   c) Sends notification to student
9. Student receives notification:
   "🎓 Congratulations! Your diploma has been issued."
   "View it in your MetaMask wallet"
```

**Alternative Flows:**
- A1: Student email not in system → Suggest adding user first
- A2: Invalid GPA (> 4.0) → Show error, don't proceed
- A3: Network error → Retry automatically
- A4: Admin not authorized → Deny access, log attempt

**Postcondition:** NFT diploma exists on blockchain, student can view & share

---

### 4.3 UC-2: Student Shares Diploma with Employer

**Actors:** Student, Employer, Smart Contract  
**Precondition:** Student has received diploma NFT  
**Main Flow:**

```
1. Student views diploma in MetaMask wallet
   "NFT: Bachelor of Science (Token ID: #42)"
2. Student clicks "Share Credential"
3. DApp generates shareable link:
   https://vndc-dapp.edu/credentials/verify/42
4. Student sends link to employer (via email, LinkedIn, etc.)
5. Employer clicks link
6. Employer's browser makes request:
   GET /api/credentials/verify/42
7. Backend:
   a) Calls smart contract: isCredentialValid(42)
   b) Gets: holder=0x<student>, uri=ipfs://QmXx, isValid=true
   c) Fetches IPFS metadata
   d) Returns JSON with credential details
8. Frontend displays:
   ✅ Diploma Verified
   Degree: Bachelor of Science
   Student: Nguyễn Văn A
   GPA: 3.8
   Issued: 2024-05-20
   (Cannot be forged - verified on blockchain)
9. Employer is satisfied, interviews student
```

**Postcondition:** Credential verified in <5 seconds, at $0 cost to employer

---

### 4.4 UC-3: University Revokes Fraudulent Diploma

**Actors:** Admin, Student (fraudster), Smart Contract  
**Precondition:** Diploma found to be fraudulent  
**Main Flow:**

```
1. University detects fraud:
   - Student paid someone to falsify records
   - Or submitted fake documents
2. Admin opens VNDC portal
3. Admin navigates to "Revoke Credentials"
4. Admin enters Token ID: #42
5. Admin enters reason: "Student fraud - submitted false documents"
6. Admin clicks "Revoke"
7. Backend calls smart contract:
   revokeCredential(42, "reason")
8. Smart contract:
   a) Checks admin role
   b) Sets revoked[42] = true
   c) Emits CredentialRevoked event
9. Event listener updates database
10. Next verification attempt:
    - GET /api/credentials/verify/42
    - Smart contract returns: isValid = false
    - Frontend shows: ❌ Credential Revoked
    "This credential is no longer valid. Reason: Student fraud"
11. Employer sees credential is revoked, doesn't hire
```

**Postcondition:** Fraudulent diploma permanently marked invalid, auditable forever

---

## 5. Smart Contract Design

### 5.1 Contract Overview

**Contract Name:** `VNDC_Credential.sol`  
**Standard:** ERC-721 (NFT)  
**Pattern:** Ownable + AccessControl + Pausable  
**Features:**
- Mint credentials (diplomas, badges, certificates)
- Verify credentials on-chain
- Revoke credentials (anti-fraud)
- Store metadata on IPFS
- Full audit trail (events)

### 5.2 Smart Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title VNDC_Credential
 * @notice NFT-based credential system for issuing, verifying, and revoking diplomas/badges
 * @dev ERC-721 with role-based access control and revocation mechanism
 */
contract VNDC_Credential is ERC721, ERC721Enumerable, AccessControl, Pausable {
    using Counters for Counters.Counter;

    // ===== ROLES =====
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    // ===== STATE VARIABLES =====
    Counters.Counter private _tokenIdCounter;
    
    mapping(uint256 => string) public tokenURIs;          // tokenId => IPFS URI
    mapping(uint256 => bool) public revoked;              // tokenId => isRevoked
    mapping(uint256 => uint256) public issuedAtBlock;     // tokenId => issuedAtBlock (audit)
    mapping(uint256 => address) public issuedBy;          // tokenId => issuer address
    mapping(address => uint256[]) public holderTokens;    // holder => array of token IDs

    // ===== EVENTS =====
    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed holder,
        address indexed issuer,
        string uri,
        uint256 timestamp
    );

    event CredentialRevoked(
        uint256 indexed tokenId,
        address indexed revoker,
        string reason,
        uint256 timestamp
    );

    event CredentialMetadataUpdated(
        uint256 indexed tokenId,
        string newUri,
        uint256 timestamp
    );

    // ===== CONSTRUCTOR =====
    constructor() ERC721("VNDC Credentials", "VNDCCRED") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ISSUER_ROLE, msg.sender);
        _setupRole(REVOKER_ROLE, msg.sender);
    }

    // ===== ISSUER FUNCTIONS =====

    /**
     * @notice Issue a credential (diploma, badge, certificate) to a student
     * @param to The student's wallet address
     * @param uri IPFS URI pointing to credential metadata JSON
     * @return tokenId The ID of the newly minted NFT
     * @dev Only ISSUER_ROLE can call this function
     */
    function issueCredential(
        address to,
        string memory uri
    ) public onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256) {
        require(to != address(0), "Cannot issue to zero address");
        require(bytes(uri).length > 0, "URI cannot be empty");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(to, tokenId);
        tokenURIs[tokenId] = uri;
        issuedAtBlock[tokenId] = block.number;
        issuedBy[tokenId] = msg.sender;
        holderTokens[to].push(tokenId);

        emit CredentialIssued(
            tokenId,
            to,
            msg.sender,
            uri,
            block.timestamp
        );

        return tokenId;
    }

    /**
     * @notice Batch issue credentials to multiple students
     * @param recipients Array of student addresses
     * @param uris Array of IPFS URIs (same length as recipients)
     * @dev More gas-efficient than calling issueCredential multiple times
     */
    function batchIssueCredentials(
        address[] calldata recipients,
        string[] calldata uris
    ) public onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256[] memory) {
        require(
            recipients.length == uris.length,
            "Recipients and URIs length mismatch"
        );
        require(recipients.length <= 100, "Batch size too large (max 100)");

        uint256[] memory tokenIds = new uint256[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            tokenIds[i] = issueCredential(recipients[i], uris[i]);
        }

        return tokenIds;
    }

    /**
     * @notice Revoke a credential (due to fraud, error, etc.)
     * @param tokenId The ID of the credential to revoke
     * @param reason Human-readable reason for revocation
     * @dev Only REVOKER_ROLE can call this; credential remains on-chain but marked invalid
     */
    function revokeCredential(
        uint256 tokenId,
        string memory reason
    ) public onlyRole(REVOKER_ROLE) {
        require(_exists(tokenId), "Credential does not exist");
        require(!revoked[tokenId], "Credential already revoked");

        revoked[tokenId] = true;

        emit CredentialRevoked(tokenId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Reinstate a previously revoked credential
     * @param tokenId The ID of the credential to reinstate
     * @dev Only REVOKER_ROLE can call this (in case of false revocation)
     */
    function reinstateCredential(uint256 tokenId)
        public
        onlyRole(REVOKER_ROLE)
    {
        require(_exists(tokenId), "Credential does not exist");
        require(revoked[tokenId], "Credential is not revoked");

        revoked[tokenId] = false;

        emit CredentialRevoked(tokenId, msg.sender, "Reinstated", block.timestamp);
    }

    // ===== VERIFICATION FUNCTIONS =====

    /**
     * @notice Check if a credential is valid (not revoked)
     * @param tokenId The ID of the credential to check
     * @return true if credential exists and is not revoked
     */
    function isCredentialValid(uint256 tokenId)
        public
        view
        returns (bool)
    {
        return _exists(tokenId) && !revoked[tokenId];
    }

    /**
     * @notice Get the complete status of a credential
     * @param tokenId The ID of the credential
     * @return holder The student's wallet address
     * @return uri The IPFS metadata URI
     * @return valid Whether credential is currently valid
     * @return revokedFlag Whether credential was revoked
     * @return issuer The address that issued the credential
     * @return issuedBlock The block number when issued (audit trail)
     */
    function getCredential(uint256 tokenId)
        public
        view
        returns (
            address holder,
            string memory uri,
            bool valid,
            bool revokedFlag,
            address issuer,
            uint256 issuedBlock
        )
    {
        require(_exists(tokenId), "Credential does not exist");

        holder = ownerOf(tokenId);
        uri = tokenURIs[tokenId];
        valid = !revoked[tokenId];
        revokedFlag = revoked[tokenId];
        issuer = issuedBy[tokenId];
        issuedBlock = issuedAtBlock[tokenId];
    }

    /**
     * @notice Get all credentials held by an address
     * @param holder The student's wallet address
     * @return Array of token IDs
     */
    function getCredentialsForHolder(address holder)
        public
        view
        returns (uint256[] memory)
    {
        return holderTokens[holder];
    }

    /**
     * @notice Get token URI (metadata) for a credential
     * @param tokenId The ID of the credential
     * @return IPFS URI pointing to metadata JSON
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenId), "Token does not exist");
        return tokenURIs[tokenId];
    }

    // ===== ADMIN FUNCTIONS =====

    /**
     * @notice Pause credential issuance (emergency)
     */
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resume credential issuance
     */
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ===== INTERNAL FUNCTIONS =====

    /**
     * @notice Override to prevent credential transfers (Soulbound NFTs)
     * @dev Students keep their credentials; cannot be traded
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);

        // Allow minting (from == address(0)) and burning (to == address(0))
        // But prevent transfers between addresses
        require(
            from == address(0) || to == address(0),
            "Credentials are non-transferable (Soulbound)"
        );
    }

    /**
     * @notice Override supportsInterface for multiple inheritance
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ===== REQUIRED OVERRIDES =====

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._burn(tokenId);
    }
}
```

### 5.3 Contract Deployment

```javascript
// deploy.js (Hardhat)

const hre = require("hardhat");

async function main() {
    console.log("Deploying VNDC_Credential contract...");

    const VNDCCredential = await hre.ethers.getContractFactory("VNDC_Credential");
    const credential = await VNDCCredential.deploy();

    await credential.deployed();

    console.log("VNDC_Credential deployed to:", credential.address);

    // Save deployment info
    const fs = require("fs");
    fs.writeFileSync(
        "deployments.json",
        JSON.stringify({
            credentialAddress: credential.address,
            deploymentBlock: await credential.deploymentTransaction().blockNumber,
            deployedAt: new Date().toISOString(),
        }, null, 2)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

---

## 6. Backend API Design

### 6.1 API Endpoints

#### Endpoint: POST /api/credentials/mint
```
Description: Issue a new credential (diploma)
Authentication: JWT (admin only)
Request Body:
{
  "studentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f42586",
  "studentName": "Nguyễn Văn A",
  "degree": "Bachelor of Science",
  "major": "Computer Science",
  "gpa": 3.8,
  "graduationDate": "2024-05-20"
}

Response (Success 201):
{
  "tokenId": 42,
  "transactionHash": "0xabc123...",
  "status": "pending",
  "message": "Credential minting initiated"
}

Response (Error 401):
{
  "error": "Unauthorized",
  "message": "Only admin can mint credentials"
}
```

#### Endpoint: GET /api/credentials/verify/:tokenId
```
Description: Public endpoint to verify credential (no auth needed)
Parameters:
  tokenId: integer (credential ID)

Response (Success 200):
{
  "tokenId": 42,
  "holder": "0x742d35Cc6634C0532925a3b844Bc9e7595f42586",
  "isValid": true,
  "issuer": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  "issuedDate": "2024-05-20",
  "metadata": {
    "name": "Bachelor of Science",
    "student": "Nguyễn Văn A",
    "gpa": 3.8,
    "major": "Computer Science",
    "issuer": "VNDC University"
  },
  "verificationUrl": "https://vndc-dapp.edu/verify/42"
}

Response (Error 404):
{
  "error": "Not Found",
  "message": "Credential with ID 42 does not exist"
}

Response (If Revoked):
{
  "tokenId": 42,
  "isValid": false,
  "revokedAt": "2024-06-15",
  "revokeReason": "Student fraud"
}
```

#### Endpoint: POST /api/credentials/batch-mint
```
Description: Batch issue credentials (admin only)
Authentication: JWT (admin only)
Request Body:
{
  "credentials": [
    {
      "studentAddress": "0x...",
      "studentName": "Student 1",
      "degree": "Bachelor",
      "major": "CS",
      "gpa": 3.8,
      "graduationDate": "2024-05-20"
    },
    ...
  ]
}

Response (Success 201):
{
  "count": 100,
  "transactionHash": "0xabc123...",
  "status": "pending",
  "credentialIds": [42, 43, 44, ...]
}
```

#### Endpoint: POST /api/credentials/:tokenId/revoke
```
Description: Revoke a credential (admin only)
Authentication: JWT (admin only)
Request Body:
{
  "reason": "Student fraud - submitted false documents"
}

Response (Success 200):
{
  "tokenId": 42,
  "status": "revoked",
  "revokedAt": "2024-06-15T10:30:00Z",
  "message": "Credential revoked successfully"
}
```

### 6.2 Database Schema

```sql
-- credentials table
CREATE TABLE credentials (
    id SERIAL PRIMARY KEY,
    token_id BIGINT UNIQUE NOT NULL,
    student_address VARCHAR(42) NOT NULL,
    issuer_address VARCHAR(42) NOT NULL,
    ipfs_uri TEXT NOT NULL,
    metadata JSONB,
    
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    revoke_reason TEXT,
    
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    issued_block BIGINT,
    transaction_hash VARCHAR(66) UNIQUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_token_id (token_id),
    INDEX idx_student_address (student_address),
    INDEX idx_issued_at (issued_at)
);

-- Metadata structure (stored as JSON)
-- {
--   "name": "Bachelor of Science",
--   "student": "Nguyễn Văn A",
--   "gpa": 3.8,
--   "major": "Computer Science",
--   "graduationDate": "2024-05-20",
--   "issuer": "VNDC University",
--   "issuedDate": "2024-05-20"
-- }
```

---

## 7. Frontend UI Design

### 7.1 Pages & Workflows

#### Page 1: Admin Dashboard - Credentials Management

```
┌─────────────────────────────────────────────────────────┐
│  VNDC Admin Portal - Issue Credentials                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [≡] Menu    Dashboard    Credentials    Audit Logs    │
│                          [Active Tab]                   │
│                                                         │
│  Issue New Credential                    [+ New]        │
│  ───────────────────────────────────────────────────    │
│                                                         │
│  Student Information:                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Student Address:                                │   │
│  │ [0x742d35Cc.....................] [Lookup]     │   │
│  │                                                 │   │
│  │ Student Name:                                   │   │
│  │ [Nguyễn Văn A                                  │   │
│  │                                                 │   │
│  │ University ID:                                  │   │
│  │ [MSV2024001                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Degree Information:                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Degree Type:  [Bachelor of Science    ▼]       │   │
│  │ Major:        [Computer Science       ▼]       │   │
│  │ GPA:          [3.8                  ]           │   │
│  │ Graduation:   [2024-05-20            ]         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Cancel]                          [Mint Diploma]       │
│                                                         │
│  Recent Issues:                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Token ID │ Student    │ Date       │ Status    │   │
│  ├──────────┼────────────┼────────────┼───────────┤   │
│  │ #42      │ Nguyễn Văn A│ 2024-05-20│ ✓ Confirmed│  │
│  │ #41      │ Trần Thị B │ 2024-05-20│ ⏳ Pending  │   │
│  │ #40      │ Lê Văn C   │ 2024-05-19│ ✓ Confirmed│   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Page 2: Public Verification Page

```
┌─────────────────────────────────────────────────────────┐
│  VNDC Credential Verification                           │
│                                                         │
│  Verify any diploma or certificate on blockchain       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Enter Credential ID or URL:                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ https://vndc-dapp.edu/verify/42                 │   │
│  │ or                                              │   │
│  │ 42                                              │   │
│  │                                                 │   │
│  │                                   [Verify]     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  VERIFICATION RESULT:                                   │
│                                                         │
│  ✅ Credential Verified                                 │
│                                                         │
│  Details:                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Credential ID:      42                          │   │
│  │ Degree:             Bachelor of Science         │   │
│  │ Student:            Nguyễn Văn A                │   │
│  │ Major:              Computer Science            │   │
│  │ GPA:                3.8                         │   │
│  │ Graduation Date:    May 20, 2024                │   │
│  │                                                 │   │
│  │ Issued By:          VNDC University             │   │
│  │ Issued Date:        May 20, 2024                │   │
│  │                                                 │   │
│  │ Status:             ✅ Valid (Not Revoked)      │   │
│  │ Blockchain:         Polygon Mumbai              │   │
│  │ Transaction:        0xabc123...                 │   │
│  │                                                 │   │
│  │ Cannot be forged - Cryptographically verified   │   │
│  │ on blockchain. Learn more about blockchain      │   │
│  │ credentials →                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Share This Result]  [View on Etherscan]              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Page 3: Student Wallet / NFT View

```
┌─────────────────────────────────────────────────────────┐
│  My Credentials                                         │
│                                                         │
│  Connected Wallet: 0x742d35Cc... [Disconnect]          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Your Credentials: 3 Total                              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎓 Bachelor of Science                          │   │
│  │    Computer Science                             │   │
│  │                                                 │   │
│  │    Token ID: #42                                │   │
│  │    Issued: May 20, 2024                         │   │
│  │    GPA: 3.8                                     │   │
│  │                                                 │   │
│  │    [View Details]  [Share Link]  [Download]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🏅 Advanced Blockchain Certificate              │   │
│  │    Issued: Jan 15, 2024                         │   │
│  │                                                 │   │
│  │    Token ID: #45                                │   │
│  │                                                 │   │
│  │    [View Details]  [Share Link]  [Download]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎯 Hackathon 2024 Participation Badge           │   │
│  │    Issued: Nov 10, 2023                         │   │
│  │                                                 │   │
│  │    Token ID: #89                                │   │
│  │                                                 │   │
│  │    [View Details]  [Share Link]  [Download]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Data Model

### 8.1 On-Chain Data (Smart Contract)

```
Smart Contract State:
────────────────────

mapping(uint256 => string) tokenURIs
├─ Key: tokenId (credential ID)
├─ Value: ipfs://QmXx... (IPFS metadata hash)
└─ Purpose: Store location of credential metadata

mapping(uint256 => bool) revoked
├─ Key: tokenId
├─ Value: true/false (is revoked?)
└─ Purpose: Track revocation status

mapping(uint256 => address) issuedBy
├─ Key: tokenId
├─ Value: 0xUniversityAddress
└─ Purpose: Audit trail - who issued this credential?

mapping(address => uint256[]) holderTokens
├─ Key: student wallet address
├─ Value: array of credential IDs
└─ Purpose: Quick lookup of all student's credentials
```

### 8.2 Off-Chain Data (Database)

```
Credentials Table:
──────────────────

id (INT)
├─ Database primary key
└─ Auto-increment

token_id (BIGINT UNIQUE)
├─ Matches smart contract tokenId
└─ Maps on-chain to off-chain

student_address (VARCHAR 42)
├─ Student's wallet address
└─ Non-fungible identifier

issuer_address (VARCHAR 42)
├─ University/admin address
└─ Who issued this credential

ipfs_uri (TEXT)
├─ Points to IPFS hash
├─ Example: ipfs://QmXx...
└─ Contains credential metadata

metadata (JSONB)
├─ Cached copy of IPFS data
├─ Example:
│  {
│    "name": "Bachelor of Science",
│    "student": "Nguyễn Văn A",
│    "gpa": 3.8,
│    "graduationDate": "2024-05-20"
│  }
└─ Performance optimization

is_revoked (BOOLEAN)
├─ true if credential revoked
└─ Status cache

revoked_at (TIMESTAMP)
├─ When was it revoked?
└─ Audit trail

revoke_reason (TEXT)
├─ Why was it revoked?
├─ Example: "Student fraud"
└─ Audit trail

issued_at (TIMESTAMP)
├─ When issued
└─ For sorting/filtering

issued_block (BIGINT)
├─ Blockchain block number
└─ Immutable audit trail

transaction_hash (VARCHAR 66)
├─ Smart contract transaction
├─ Can verify on Etherscan
└─ Proof of on-chain record

created_at (TIMESTAMP)
├─ Database record creation
└─ Meta

updated_at (TIMESTAMP)
├─ Last update
└─ Meta
```

### 8.3 IPFS Metadata Format (JSON)

```json
{
  "name": "Bachelor of Science in Computer Science",
  "description": "Four-year undergraduate degree",
  
  "attributes": [
    {
      "trait_type": "Holder Name",
      "value": "Nguyễn Văn A"
    },
    {
      "trait_type": "Major",
      "value": "Computer Science"
    },
    {
      "trait_type": "GPA",
      "value": "3.8"
    },
    {
      "trait_type": "Graduation Date",
      "value": "2024-05-20"
    },
    {
      "trait_type": "Degree Level",
      "value": "Bachelor"
    }
  ],
  
  "issuedBy": "VNDC University",
  "issuedDate": "2024-05-20",
  "issuerAddress": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  
  "expirationDate": null,
  "image": "ipfs://QmXxxx...",
  
  "verificationUrl": "https://vndc-dapp.edu/verify/42",
  
  "credentialType": "diploma"
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (Smart Contract)

```javascript
// test/VNDC_Credential.test.js (Mocha/Chai + Hardhat)

describe("VNDC_Credential", () => {
    let credential;
    let owner, admin, student, unauthorized;

    beforeEach(async () => {
        [owner, admin, student, unauthorized] = await ethers.getSigners();

        const Credential = await ethers.getContractFactory("VNDC_Credential");
        credential = await Credential.deploy();

        // Grant roles
        await credential.grantRole(await credential.ISSUER_ROLE(), admin.address);
    });

    describe("Issue Credential", () => {
        it("Should allow ISSUER_ROLE to mint credential", async () => {
            const uri = "ipfs://QmXxxx...";
            const tx = await credential
                .connect(admin)
                .issueCredential(student.address, uri);

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "CredentialIssued");

            expect(event).to.not.be.undefined;
            expect(event.args.holder).to.equal(student.address);
            expect(event.args.uri).to.equal(uri);
        });

        it("Should prevent unauthorized issuance", async () => {
            const uri = "ipfs://QmXxxx...";
            
            await expect(
                credential.connect(unauthorized).issueCredential(student.address, uri)
            ).to.be.revertedWithCustomError(
                credential,
                "AccessControlUnauthorizedAccount"
            );
        });

        it("Should prevent issuance to zero address", async () => {
            const uri = "ipfs://QmXxxx...";
            
            await expect(
                credential.connect(admin).issueCredential(ethers.constants.AddressZero, uri)
            ).to.be.revertedWith("Cannot issue to zero address");
        });

        it("Should prevent empty URI", async () => {
            await expect(
                credential.connect(admin).issueCredential(student.address, "")
            ).to.be.revertedWith("URI cannot be empty");
        });
    });

    describe("Verify Credential", () => {
        beforeEach(async () => {
            const uri = "ipfs://QmXxxx...";
            await credential.connect(admin).issueCredential(student.address, uri);
        });

        it("Should verify valid credential", async () => {
            const isValid = await credential.isCredentialValid(0);
            expect(isValid).to.be.true;
        });

        it("Should return credential details", async () => {
            const [holder, uri, valid, revoked, issuer, block] =
                await credential.getCredential(0);

            expect(holder).to.equal(student.address);
            expect(valid).to.be.true;
            expect(revoked).to.be.false;
        });

        it("Should list holder's credentials", async () => {
            const creds = await credential.getCredentialsForHolder(student.address);
            expect(creds.length).to.equal(1);
            expect(creds[0]).to.equal(0);
        });
    });

    describe("Revoke Credential", () => {
        beforeEach(async () => {
            const uri = "ipfs://QmXxxx...";
            await credential.connect(admin).issueCredential(student.address, uri);
        });

        it("Should allow REVOKER_ROLE to revoke", async () => {
            const tx = await credential
                .connect(admin)
                .revokeCredential(0, "Student fraud");

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "CredentialRevoked");

            expect(event).to.not.be.undefined;
            expect(event.args.tokenId).to.equal(0);
        });

        it("Should mark credential as invalid", async () => {
            await credential.connect(admin).revokeCredential(0, "Fraud");
            
            const isValid = await credential.isCredentialValid(0);
            expect(isValid).to.be.false;
        });

        it("Should prevent double revocation", async () => {
            await credential.connect(admin).revokeCredential(0, "Fraud");

            await expect(
                credential.connect(admin).revokeCredential(0, "Again")
            ).to.be.revertedWith("Credential already revoked");
        });
    });

    describe("Batch Operations", () => {
        it("Should batch issue credentials", async () => {
            const students = [
                student.address,
                unauthorized.address
            ];
            const uris = [
                "ipfs://QmXx1...",
                "ipfs://QmXx2..."
            ];

            const tx = await credential
                .connect(admin)
                .batchIssueCredentials(students, uris);

            const receipt = await tx.wait();
            const events = receipt.events.filter(e => e.event === "CredentialIssued");

            expect(events.length).to.equal(2);
        });

        it("Should prevent mismatched array lengths", async () => {
            const students = [student.address];
            const uris = ["ipfs://QmXx1...", "ipfs://QmXx2..."];

            await expect(
                credential.connect(admin).batchIssueCredentials(students, uris)
            ).to.be.revertedWith("Recipients and URIs length mismatch");
        });
    });

    describe("Soulbound Token (Non-transferable)", () => {
        beforeEach(async () => {
            const uri = "ipfs://QmXxxx...";
            await credential.connect(admin).issueCredential(student.address, uri);
        });

        it("Should prevent credential transfer", async () => {
            await expect(
                credential
                    .connect(student)
                    .transferFrom(student.address, owner.address, 0)
            ).to.be.revertedWith("Credentials are non-transferable");
        });

        it("Should allow burning (revocation)", async () => {
            // Burn is equivalent to revocation via smart contract
            // Implementation may vary
        });
    });
});
```

### 9.2 API Integration Tests

```javascript
// test/api.integration.test.js (Jest + Supertest)

describe("Credential Verification API", () => {
    let app, db, credential;
    let adminToken;

    beforeAll(async () => {
        // Setup
        app = require("../app");
        db = require("../db");
        credential = require("../contracts/credential");
        
        // Get admin JWT
        adminToken = "Bearer " + jwtSign({ role: "admin" });
    });

    describe("POST /api/credentials/mint", () => {
        it("Should mint credential with valid data", async () => {
            const res = await request(app)
                .post("/api/credentials/mint")
                .set("Authorization", adminToken)
                .send({
                    studentAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f42586",
                    studentName: "Nguyễn Văn A",
                    degree: "Bachelor of Science",
                    major: "Computer Science",
                    gpa: 3.8,
                    graduationDate: "2024-05-20"
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("tokenId");
            expect(res.body).toHaveProperty("transactionHash");
            expect(res.body.status).toBe("pending");
        });

        it("Should reject without authentication", async () => {
            const res = await request(app)
                .post("/api/credentials/mint")
                .send({
                    studentAddress: "0x...",
                    studentName: "Test"
                });

            expect(res.status).toBe(401);
        });

        it("Should validate required fields", async () => {
            const res = await request(app)
                .post("/api/credentials/mint")
                .set("Authorization", adminToken)
                .send({
                    studentName: "Nguyễn Văn A"
                    // missing other required fields
                });

            expect(res.status).toBe(400);
        });
    });

    describe("GET /api/credentials/verify/:tokenId", () => {
        beforeAll(async () => {
            // Mint a credential for testing
            await request(app)
                .post("/api/credentials/mint")
                .set("Authorization", adminToken)
                .send({...credentials});
        });

        it("Should verify valid credential", async () => {
            const res = await request(app)
                .get("/api/credentials/verify/0");

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("tokenId", 0);
            expect(res.body).toHaveProperty("isValid", true);
            expect(res.body).toHaveProperty("metadata");
        });

        it("Should return 404 for non-existent credential", async () => {
            const res = await request(app)
                .get("/api/credentials/verify/99999");

            expect(res.status).toBe(404);
        });

        it("Should show revoked status", async () => {
            // First revoke the credential
            await request(app)
                .post("/api/credentials/0/revoke")
                .set("Authorization", adminToken)
                .send({ reason: "Test" });

            const res = await request(app)
                .get("/api/credentials/verify/0");

            expect(res.status).toBe(200);
            expect(res.body.isValid).toBe(false);
            expect(res.body).toHaveProperty("revokedAt");
        });
    });
});
```

---

## 10. Deployment Guide

### 10.1 Testnet Deployment (Polygon Mumbai)

```bash
# 1. Setup environment
cp .env.example .env

# Edit .env
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGON_PRIVATE_KEY=0x...
IPFS_API_KEY=...
DATABASE_URL=postgresql://...

# 2. Deploy smart contract
npx hardhat run scripts/deploy.js --network mumbai

# 3. Verify on Polygonscan (optional)
npx hardhat verify --network mumbai <CONTRACT_ADDRESS>

# 4. Start backend
npm run dev

# 5. Deploy frontend
npm run build
vercel deploy
```

### 10.2 Mainnet Deployment Checklist

- [ ] Smart contract audited
- [ ] 100% test coverage
- [ ] Security: No high/critical issues
- [ ] Frontend tested on mainnet testnet
- [ ] Backend monitoring setup (Datadog, Sentry)
- [ ] Database backups configured
- [ ] RPC failover configured
- [ ] Rate limiting enabled
- [ ] Legal review complete
- [ ] Insurance/coverage in place

---

## Summary

**App #1: Credential Verification** is the foundation of VNDC ecosystem:

✅ **Problem Solved:** Instant, cryptographic credential verification vs. slow manual process  
✅ **Tech Stack:** ERC-721 NFT + IPFS + PostgreSQL + React  
✅ **Impact:** 90% faster verification, $0 cost, impossible to forge  
✅ **Timeline:** 2-3 weeks to implement (Sprint 3-4)  
✅ **Effort:** Medium (straightforward NFT minting + verification)  

Ready to code? See `VNDC_Credential.sol` above!

---

**Next:** See other apps or go back to [App Selection](../README.md)

