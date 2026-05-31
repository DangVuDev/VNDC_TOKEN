# 🏛️ DAO Module - Kế Hoạch Triển Khai Chi Tiết

**Phiên bản**: 1.0  
**Ngày cập nhật**: 2026-05-20  
**Trạng thái**: Ready for Implementation  
**Scope**: 3 Use Cases (UC13, UC14, UC15) + Backend + Frontend

---

## 📋 Mục Lục

1. [Architecture Overview](#1-architecture-overview)
2. [On-Chain Design (Smart Contracts)](#2-on-chain-design-smart-contracts)
3. [Off-Chain Design (Backend)](#3-off-chain-design-backend)
4. [Frontend Design (UI/UX)](#4-frontend-design-uiux)
5. [API Specifications](#5-api-specifications)
6. [Database Schema](#6-database-schema)
7. [State Machines & Flows](#7-state-machines--flows)
8. [Worker Implementation](#8-worker-implementation)
9. [Security & Error Handling](#9-security--error-handling)
10. [Testing & Deployment](#10-testing--deployment)

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        VNDC DAO System                           │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend    │────→│   Backend    │────→│  Blockchain  │
│  (React)     │     │   (Go)       │     │ (Hardhat)    │
└──────────────┘     └──────────────┘     └──────────────┘
       ↓                   ↓                     ↓
  UI Components      Services/Handlers    DAOManager.sol
  Vote Component     DAO Service          Vote Storage
  Proposal View      Vote Handler         Token Locking
  Dashboard          Auto Tally Worker    Merkle Proofs

┌──────────────────────────────────────────────────────────────────┐
│                      Data Layer                                   │
├──────────────────────────────────────────────────────────────────┤
│  MongoDB (Offchain):                                              │
│  • dao_proposals (create, read, query by status)                 │
│  • dao_votes (record votes, calculate tallies)                   │
│  • dao_vote_history (audit trail)                                │
│                                                                   │
│  Smart Contract Storage (On-chain):                              │
│  • proposalId → Proposal data                                    │
│  • proposalId → votes[voter] = {choice, power}                   │
│  • proposalId → lockedTokens[voter]                              │
│  • tokenLocked[voter] = balance (prevents transfer during vote)  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      Workers (Background)                         │
├──────────────────────────────────────────────────────────────────┤
│  1. DAOAutoExecutionWorker (every 1 minute)                       │
│     • Check proposals where voting_end <= now                    │
│     • Tally votes from blockchain                                │
│     • Calculate winner (token-weighted)                          │
│     • Unlock tokens                                              │
│     • Execute DAO actions if applicable                          │
│                                                                   │
│  2. DAOProposalCleanupWorker (every 24 hours)                    │
│     • Archive completed proposals                                │
│     • Clean up expired proposals                                 │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Concepts

#### Token-Weighted Voting (Bình chọn có trọng số token)
- Mỗi sinh viên có 1 token = 1 vote
- Số phiếu tối đa = số dư token hiện tại (trên chuỗi + chờ xử lý)
- Token bị lock trong suốt voting period (không thể transfer)
- Lock được unlock tự động khi voting kết thúc

#### Proposal Lifecycle
```
DRAFT → ACTIVE → VOTING → CLOSED → EXECUTED
         (auto)  (duration)  (auto)    (auto)
```

#### Vote Power Calculation
```
vote_power = balance_on_chain + balance_pending
           = tokens.balanceOf(voter) + pending_balance[voter]
```

---

## 2. On-Chain Design (Smart Contracts)

### 2.1 DAOManager.sol - Contract Structure

**Tên file**: `contracts/DAOManager.sol`

#### State Variables

```solidity
// ─────────────────────────────────────
//  Proposal Storage
// ─────────────────────────────────────

mapping(uint256 => Proposal) public proposals;
mapping(uint256 => mapping(address => Vote)) public votes;  // [proposalId][voter] = Vote
mapping(uint256 => mapping(uint256 => uint256)) public choiceVotes;  // [proposalId][choiceId] = totalVotes

// Token locking during voting
mapping(uint256 => mapping(address => uint256)) public lockedTokens;  // [proposalId][voter] = lockedAmount
mapping(address => bool) public isVotingLocked;  // voter → isLocked

uint256 public proposalCounter = 0;
uint256 public minVotingPeriod = 1 days;  // Minimum voting duration
uint256 public maxVotingPeriod = 30 days;  // Maximum voting duration
```

#### Structs

```solidity
struct Proposal {
    uint256 id;
    string title;
    string description;
    address creator;
    uint256 votingStart;
    uint256 votingEnd;
    ProposalStatus status;  // DRAFT, ACTIVE, CLOSED, EXECUTED
    uint256 totalVotes;
    uint256 winningChoice;  // choiceId of winner
    string[] choices;  // ["Activity A", "Activity B", "Activity C", ...]
    uint256 createdAt;
    uint256 executedAt;
    string executionResult;
}

struct Vote {
    uint256 choiceId;
    uint256 votePower;  // amount of tokens used for voting
    uint256 timestamp;
    bool locked;  // is token still locked?
}

enum ProposalStatus {
    DRAFT,      // 0: Just created, admin can modify
    ACTIVE,     // 1: Open for voting
    CLOSED,     // 2: Voting ended, awaiting execution
    EXECUTED    // 3: Tally completed, results recorded
}

enum VoteStatus {
    PENDING,    // Vote registered, tokens locked
    CONFIRMED,  // Vote confirmed on blockchain
    UNLOCKED    // Tokens unlocked after voting ended
}
```

#### Core Functions

**1. createProposal() - Tạo đề xuất DAO**

```
Input:
  - title: string (≤ 256 chars)
  - description: string (≤ 2048 chars)
  - choices: string[] (3-10 options)
  - votingStart: uint256 (block.timestamp hoặc >= now)
  - votingEnd: uint256 (votingStart + 1 days to 30 days)

Checks:
  - caller = DAOAdmin (role check)
  - votingEnd > votingStart
  - votingDuration ∈ [1 day, 30 days]
  - choices.length ∈ [3, 10]
  - title/description not empty

Actions:
  1. proposalCounter++
  2. Create Proposal struct
  3. Set status = DRAFT
  4. Store in proposals mapping
  5. Emit ProposalCreated(proposalId, title)

Returns:
  - proposalId (uint256)
```

**2. activateProposal() - Kích hoạt đề xuất (bắt đầu voting)**

```
Input:
  - proposalId: uint256

Checks:
  - proposal.status = DRAFT
  - caller = DAOAdmin
  - voting_start >= block.timestamp

Actions:
  1. proposal.status = ACTIVE
  2. proposal.votingStart = block.timestamp
  3. Emit ProposalActivated(proposalId, voting_start, voting_end)

Returns:
  - success: bool
```

**3. castVote() - Bình chọn (người dùng ký EIP-712)**

```
Input:
  - proposalId: uint256
  - choiceId: uint256
  - votePower: uint256 (votes amount, từ offchain)
  - signature: bytes (EIP-712 signature)

Prechecks:
  - proposal.status = ACTIVE
  - block.timestamp ∈ [proposal.votingStart, proposal.votingEnd]
  - voter hasn't voted yet (votes[proposalId][voter].timestamp = 0)
  - choiceId ∈ [0, proposal.choices.length)
  - votePower ≤ voter's balance (offchain calculated, verified via signature)

Verification:
  - Verify EIP-712 signature
  - Recover voter address from signature
  - Re-check balance ≥ votePower

Actions:
  1. Lock tokens: lockedTokens[proposalId][voter] = votePower
  2. Record vote: votes[proposalId][voter] = Vote{choiceId, votePower, block.timestamp, true}
  3. Increment choice votes: choiceVotes[proposalId][choiceId] += votePower
  4. Increment total votes: proposals[proposalId].totalVotes += votePower
  5. Mark voter as voting-locked: isVotingLocked[voter] = true
  6. Emit VoteCast(proposalId, voter, choiceId, votePower)

Returns:
  - success: bool
```

**4. tallyVotes() - Tính toán kết quả (gọi từ backend worker)**

```
Input:
  - proposalId: uint256

Prechecks:
  - proposal.status = ACTIVE
  - block.timestamp > proposal.votingEnd
  - caller = DAOExecutor (backend relayer)

Actions:
  1. Find choice with highest votes
  2. Set proposal.winningChoice = choiceId
  3. proposal.status = CLOSED
  4. Emit ProposalClosed(proposalId, winning_choice, total_votes)

Returns:
  - winningChoice: uint256
  - totalVotes: uint256
```

**5. unlockTokens() - Mở khóa tokens (auto gọi sau voting)**

```
Input:
  - proposalId: uint256
  - voters: address[] (batch unlock)

Prechecks:
  - proposal.status = CLOSED
  - caller = DAOExecutor

Actions (for each voter):
  1. Get lockedAmount = lockedTokens[proposalId][voter]
  2. Clear: lockedTokens[proposalId][voter] = 0
  3. Mark: votes[proposalId][voter].locked = false
  4. Check if voter has other locked proposals
  5. If no other locks: isVotingLocked[voter] = false
  6. Emit TokensUnlocked(proposalId, voter, lockedAmount)

Returns:
  - unlockedCount: uint256
```

**6. executeProposal() - Thực thi kết quả (DAO actions)**

```
Input:
  - proposalId: uint256
  - executionData: bytes (encoded action)

Prechecks:
  - proposal.status = CLOSED
  - proposal.executedAt = 0 (not executed yet)
  - caller = DAOExecutor

Actions:
  1. Decode executionData based on winning choice
  2. If choice = "Activate Activity X":
     - Call ActivityManager.activateActivity(activityId)
  3. If choice = "Mint Bonus NFT":
     - Call NFTCollection.mintBonus()
  4. If choice = "Adjust Token Rate":
     - Update tokenRewardRate parameter
  5. proposal.status = EXECUTED
  6. proposal.executedAt = block.timestamp
  7. Emit ProposalExecuted(proposalId, execution_result)

Returns:
  - success: bool
```

### 2.2 Token Locking Mechanism

#### Logic: Tại sao cần locking?
- Ngăn chặn "double voting" bằng cách transfer token đi rồi vote lại
- Đảm bảo mỗi token chỉ được sử dụng một lần trong một proposal
- Duy trì stake của voter trong proposal (họ cam kết vote power của mình)

#### Implementation:

**Khi vote được cast:**
```
lockedTokens[proposalId][voter] = votePower
isVotingLocked[voter] = true
→ VNDCToken.transfer() thất bại nếu từ voter có locked tokens
```

**Khi voting kết thúc:**
```
DAOAutoExecutionWorker gọi:
  1. tallyVotes() - Tính kết quả
  2. unlockTokens() - Mở khóa
→ lockedTokens[proposalId][voter] = 0
→ isVotingLocked[voter] = false (nếu không có lock khác)
→ Voter có thể transfer lại
```

### 2.3 EIP-712 Signature Structure

**Message Hash (EIP-712):**

```javascript
// Domain Separator
{
  name: "VNDC",
  version: "1",
  chainId: 31337,  // Hardhat chain
  verifyingContract: "0xDAOManagerAddress"
}

// Vote Struct Type
{
  Vote: [
    { name: "proposalId", type: "uint256" },
    { name: "choiceId", type: "uint256" },
    { name: "votePower", type: "uint256" },
    { name: "nonce", type: "uint256" }  // prevent replay
  ]
}

// Message to Sign
{
  proposalId: 1,
  choiceId: 0,           // choice index
  votePower: 1000,       // wei equivalent
  nonce: voter_nonce     // incremented per vote
}
```

---

## 3. Off-Chain Design (Backend)

### 3.1 Domain Layer

**Location**: `internal/domain/dao.go`

#### Entities

```
Proposal
├── ID: string (UUID)
├── Title: string
├── Description: string
├── Creator: string (wallet address)
├── VotingStart: time.Time
├── VotingEnd: time.Time
├── Status: ProposalStatus (DRAFT | ACTIVE | CLOSED | EXECUTED)
├── Choices: []string (activity names or actions)
├── TotalVotes: int64 (wei)
├── WinningChoice: int (choiceId)
├── VoteBreakdown: map[int]int64 (choiceId → totalVotes)
├── CreatedAt: time.Time
├── UpdatedAt: time.Time
├── ExecutedAt: *time.Time
└── ExecutionResult: string

Vote
├── ID: string (UUID)
├── ProposalID: string
├── VoterAddress: string (checksummed)
├── ChoiceID: int
├── VotePower: string (wei as string)
├── Status: VoteStatus (PENDING | CONFIRMED | UNLOCKED)
├── IsLocked: bool
├── TxHash: *string
├── CreatedAt: time.Time
└── ConfirmedAt: *time.Time

VoteHistory (Audit Trail)
├── ID: string (UUID)
├── ProposalID: string
├── VoterAddress: string
├── Action: string (VOTE_CAST | VOTE_REVOKED | TOKENS_UNLOCKED)
├── ChoiceID: *int
├── VotePower: *string
├── TxHash: *string
├── Timestamp: time.Time
└── Details: map[string]any
```

### 3.2 Repository Layer

**Location**: `internal/ports/dao.go`

```go
// DAOProposalRepository
interface DAOProposalRepository {
    Create(ctx, proposal *Proposal) error
    FindByID(ctx, proposalID string) (*Proposal, error)
    FindByStatus(ctx, status ProposalStatus) ([]*Proposal, error)
    FindActive(ctx) ([]*Proposal, error)  // status = ACTIVE
    FindVotingEnded(ctx) ([]*Proposal, error)  // votingEnd <= now, status = ACTIVE
    Update(ctx, proposalID string, updates map[string]any) error
    List(ctx, page, pageSize int) ([]*Proposal, int64, error)  // with pagination
    GetProposalStats(ctx, proposalID string) (map[string]any, error)  // {total_votes, breakdown}
}

// DAOVoteRepository
interface DAOVoteRepository {
    Create(ctx, vote *Vote) error
    FindByID(ctx, voteID string) (*Vote, error)
    FindByProposalAndVoter(ctx, proposalID, voter string) (*Vote, error)
    FindByProposal(ctx, proposalID string) ([]*Vote, error)
    FindByVoter(ctx, voter string) ([]*Vote, error)
    Update(ctx, voteID string, updates map[string]any) error
    BulkUpdateStatus(ctx, voteIDs []string, status VoteStatus) error
    GetChoiceVotes(ctx, proposalID string) (map[int]int64, error)  // choiceId → totalVotes
    HasVoted(ctx, proposalID, voter string) (bool, error)
}

// DAOVoteHistoryRepository
interface DAOVoteHistoryRepository {
    Create(ctx, history *VoteHistory) error
    FindByProposal(ctx, proposalID string) ([]*VoteHistory, error)
    FindByVoter(ctx, voter string) ([]*VoteHistory, error)
    GetAuditTrail(ctx, proposalID string) ([]*VoteHistory, error)
}
```

### 3.3 Service Layer

**Location**: `internal/application/dao/service.go`

#### DAOService

```go
type DAOService struct {
    proposalRepo      ports.DAOProposalRepository
    voteRepo          ports.DAOVoteRepository
    historyRepo       ports.DAOVoteHistoryRepository
    transactionRepo   ports.TransactionRepository
    userRepo          ports.UserRepository
    daoAdapter        ports.DAOAdapter  // calls Smart Contract
    log               logger.Logger
}

// ═══════════════════════════════════════
//  Core Methods
// ═══════════════════════════════════════

// CreateProposal(ctx, title, description, choices, votingStart, votingEnd, creator)
//   → Validate inputs
//   → Create Proposal entity
//   → Call daoAdapter.CreateProposal() (on-chain)
//   → Save to proposalRepo
//   → Return proposalID

// ActivateProposal(ctx, proposalID)
//   → Check status = DRAFT
//   → Call daoAdapter.ActivateProposal() (on-chain)
//   → Update status → ACTIVE
//   → Return success

// CastVote(ctx, proposalID, voter, choiceID, votePower, signature)
//   → Check proposal.status = ACTIVE
//   → Check votingEnd >= now
//   → Check !HasVoted(proposalID, voter)
//   → Verify EIP-712 signature
//   → Get voter balance (on-chain + pending)
//   → Check votePower ≤ balance
//   → Call daoAdapter.CastVote() (on-chain, locks tokens)
//   → Create Vote entity
//   → Create Transaction record (for settlement)
//   → Save Vote to voteRepo
//   → Create VoteHistory record
//   → Emit VoteCast event
//   → Return voteID

// TallyVotes(ctx, proposalID)
//   → Check proposal.status = ACTIVE
//   → Check votingEnd < now
//   → Call daoAdapter.TallyVotes() (on-chain)
//   → Get choiceVotes breakdown
//   → Calculate winner
//   → Update proposal: status → CLOSED, winningChoice
//   → Create VoteHistory "TALLY_COMPLETE"
//   → Return {winningChoice, totalVotes, breakdown}

// UnlockTokens(ctx, proposalID, voters [])
//   → Check proposal.status = CLOSED
//   → For each voter:
//       - Call daoAdapter.UnlockTokens()
//       - Update vote: isLocked = false, status → UNLOCKED
//       - Create VoteHistory "TOKENS_UNLOCKED"
//   → Return unlockedCount

// ExecuteProposal(ctx, proposalID, executionData)
//   → Check proposal.status = CLOSED
//   → Decode executionData (choice-specific action)
//   → Execute action (e.g., activate activity, mint NFT, update parameter)
//   → Update proposal: status → EXECUTED, executedAt
//   → Create Transaction record (if on-chain action)
//   → Create VoteHistory "PROPOSAL_EXECUTED"
//   → Return executionResult

// GetProposalDetails(ctx, proposalID, viewer)
//   → Get Proposal
//   → Get vote breakdown
//   → Check if viewer has voted
//   → Return enriched proposal with statistics
//   → Calculate isVotingOpen, remainingTime

// GetUserVotingHistory(ctx, voter)
//   → Query voteRepo.FindByVoter(voter)
//   → For each vote: get proposal details, choice name
//   → Sort by votedAt DESC
//   → Return list of user's votes with context

// IsTokensLocked(ctx, voter, proposalID)
//   → Check isVotingLocked flag on chain
//   → Return bool

// GetProposalStats(ctx, proposalID)
//   → Get total votes, choice breakdown
//   → Calculate percentage per choice
//   → Get voter count, avg vote power
//   → Return statistics for dashboard
```

### 3.4 HTTP Handler Layer

**Location**: `internal/application/dao/handler.go`

#### Routes

```
POST   /v1/dao/proposals
       - CreateProposal
       - Body: {title, description, choices, votingStart, votingEnd}
       - Auth: Admin only
       - Returns: {proposalId, status, votingStart, votingEnd}

PATCH  /v1/dao/proposals/:id/activate
       - ActivateProposal
       - Auth: Admin only
       - Returns: {status, votingStart, votingEnd}

GET    /v1/dao/proposals
       - ListProposals
       - Query: page, pageSize, status (filter)
       - Returns: {data: [proposals], pagination: {total, pages}}

GET    /v1/dao/proposals/:id
       - GetProposalDetails
       - Returns: {proposal, voteBreakdown, currentUserVote, isVotingOpen}

POST   /v1/dao/votes
       - CastVote
       - Body: {proposalId, choiceId, votePower, signature, nonce}
       - Auth: Student (token-authenticated)
       - Signature: EIP-712 signed vote message
       - Returns: {voteId, status, lockedAmount}

GET    /v1/dao/proposals/:id/results
       - GetProposalResults (after voting ended)
       - Returns: {winner, totalVotes, breakdown, status}

GET    /v1/dao/votes/my-history
       - GetUserVotingHistory
       - Auth: Student
       - Returns: [votes] with proposal context

PATCH  /v1/dao/proposals/:id/execute
       - ExecuteProposal (manual trigger, optional)
       - Auth: Admin
       - Body: {executionData}
       - Returns: {executionResult}

GET    /v1/dao/stats
       - GetDAOStats
       - Returns: {totalProposals, activeProposals, votingParticipants, avgVotePower}
```

### 3.5 Worker Layer

**Location**: `internal/workers/dao_worker.go`

#### DAOAutoExecutionWorker

```
Responsibility:
  - Automatically tally votes when voting period ends
  - Unlock tokens after tally
  - Execute DAO actions based on voting results

Schedule:
  - Runs every 1 minute (configurable)
  - Batch processes multiple proposals per tick

Flow:
  1. Tick (every 1 minute)
  2. Query: SELECT * FROM proposals WHERE status='ACTIVE' AND voting_end <= now
  3. For each proposal:
     a. Call daoService.TallyVotes(proposalID)
     b. Get winning choice + vote breakdown
     c. Call daoService.UnlockTokens(proposalID, voters)
     d. Update all votes: isLocked = false, status → UNLOCKED
     e. Create Transaction record if needed
     f. Call daoService.ExecuteProposal(proposalID, executionData)
     g. Update proposal.status → EXECUTED
     h. Create VoteHistory entries for audit trail
  4. Log summary: {proposal_count, executed_count, failed_count}

Error Handling:
  - If tally fails: retry in next tick (max 3 retries)
  - If unlock fails: log error, continue (tokens auto-unlock after 7 days)
  - If execution fails: mark as ERROR, alert admin

Configuration:
  - tickInterval: 1 minute (can tune to 30s for faster execution)
  - batchSize: max 10 proposals per tick
  - maxRetries: 3
  - timeout: 30 seconds per proposal

Example Log Output:
  [INFO] dao_worker: proposal_tally_completed (proposalId=uuid, winner=0, totalVotes=5000wei, voters=150)
  [INFO] dao_worker: tokens_unlocked (proposalId=uuid, unlockedCount=150, totalAmount=5000wei)
  [INFO] dao_worker: proposal_executed (proposalId=uuid, action=activate_activity, result=success)
```

#### DAOProposalCleanupWorker (Optional)

```
Responsibility:
  - Archive old/completed proposals
  - Clean up temporary vote data
  - Maintenance tasks

Schedule:
  - Runs once per 24 hours

Actions:
  1. Find proposals where status=EXECUTED AND executedAt < 7 days ago
  2. Move to archive collection: proposals_archive
  3. Delete temporary vote entries (optional: for storage optimization)
  4. Update MongoDB indexes if needed
```

---

## 4. Frontend Design (UI/UX)

### 4.1 Pages & Components

#### Page 1: DAO Dashboard (`/dao`)

**Purpose**: Hiển thị overview DAO, danh sách proposals, thống kê

**Components**:
```
┌─────────────────────────────────────────┐
│ Header: "DAO Governance System"          │
│ User's Voting Power: 5000 VNDC           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Stats Card Row:                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Active   │ │ Completed│ │ Total    │ │
│ │ 3        │ │ 12       │ │ 15       │ │
│ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ My Voting History (Recent 5)             │
│ ┌────────────────────────────────────┐  │
│ │ [Proposal 1] | Choice: Activity A  │  │
│ │   Power: 1000 | Status: CONFIRMED  │  │
│ └────────────────────────────────────┘  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Active Proposals (List):                 │
│ ┌───────────────────────────────────┐   │
│ │ Proposal ID | Title | Voting End  │   │
│ │ #1          | Incr. | 2 days left │   │
│ │ #2          | Mint  | 5 days left │   │
│ │ #3          | Adjus | 7 days left │   │
│ └───────────────────────────────────┘   │
│                                          │
│ [Create New Proposal] (Admin only)      │
│ [View All Proposals]                    │
└─────────────────────────────────────────┘
```

**State & Data**:
- `activeProposals`: Proposal[] (API: GET /dao/proposals?status=ACTIVE)
- `completedProposals`: Proposal[] (API: GET /dao/proposals?status=EXECUTED)
- `userVotingHistory`: Vote[] (API: GET /dao/votes/my-history)
- `daoStats`: {totalProposals, activeCount, votedCount, avgPower}
- `userVotingPower`: number (calculated from balance on-chain + pending)

**Actions**:
- Click proposal → Navigate to ProposalDetailPage
- Click "Create" → Navigate to CreateProposalPage (admin)
- Click "View All" → Navigate to ProposalsListPage

---

#### Page 2: Proposal Detail (`/dao/proposals/:id`)

**Purpose**: Chi tiết proposal, vote breakdown, voting interface

**Components**:

```
┌──────────────────────────────────────────┐
│ Proposal Header:                          │
│ Title: "Increase Reward Rate to 0.2 VNDC" │
│ Status: [ACTIVE] | Voting ends: 2 days    │
│ Creator: @admin_team                      │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Description:                              │
│ "Increase token reward for activities..." │
│ "Vote to approve or reject..."            │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Vote Progress Bar (If status = ACTIVE):   │
│ Choice A: [████████░░] 60% (3000 votes)   │
│ Choice B: [██░░░░░░░░] 20% (1000 votes)   │
│ Choice C: [░░░░░░░░░░] 20% (1000 votes)   │
│ Total: 5000 votes | Participants: 150    │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Your Vote (If status = ACTIVE):           │
│                                            │
│ ○ Choice A (Approve increase)             │
│ ○ Choice B (Keep current rate)            │
│ ○ Choice C (Decrease rate)                │
│                                            │
│ Your voting power: [1000 ▼]  VNDC         │
│ (Max: 5000 VNDC available)                │
│                                            │
│ [Sign & Vote] button                      │
│                                            │
│ Status: [Not Voted] / [Voted] / [Locked]  │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Results (If status = CLOSED/EXECUTED):    │
│ Winner: Choice A (Approved)                │
│ Your Vote: Choice A ✓                      │
│ Execution Status: [EXECUTED]               │
│ Executed At: 2 hours ago                   │
└──────────────────────────────────────────┘
```

**State & Data**:
- `proposal`: Proposal (API: GET /dao/proposals/:id)
- `voteBreakdown`: {choiceId: {votes, percentage, voterCount}}
- `userVote`: Vote | null (API: GET /dao/proposals/:id → included)
- `isVotingOpen`: boolean (votingEnd > now && status = ACTIVE)
- `userVotingPower`: number

**Actions**:
- Select choice (radio button)
- Adjust voting power slider (0 to userVotingPower max)
- Click "Sign & Vote":
  1. Create EIP-712 vote message
  2. Request MetaMask signature
  3. Submit to backend: POST /dao/votes
  4. Show success message
  5. Update vote display

---

#### Page 3: Create Proposal (`/dao/proposals/new`) - Admin Only

**Purpose**: Tạo DAO proposal mới

```
┌──────────────────────────────────────────┐
│ Create New Proposal                       │
├──────────────────────────────────────────┤
│                                            │
│ Title: [                                   │ 
│        ________________________________]   │
│        "Max 256 characters"                │
│                                            │
│ Description:                               │
│ [                                          │
│ ____________________________________        │
│ ____________________________________        │
│ ]                                          │
│ "Max 2048 characters"                      │
│                                            │
│ Voting Duration:                           │
│ Start: [Select Date/Time] ↓                │
│ End:   [Select Date/Time] ↓                │
│ Duration: [1 day to 30 days]               │
│                                            │
│ Choices (3-10 options):                    │
│ ┌────────────────────────────────────┐   │
│ │ ① Choice A: [Activity A ▼] ×      │   │
│ │ ② Choice B: [Activity B ▼] ×      │   │
│ │ ③ Choice C: [Activity C ▼] ×      │   │
│ │ [+ Add Choice]                     │   │
│ └────────────────────────────────────┘   │
│                                            │
│ [Create Proposal] [Cancel]                │
└──────────────────────────────────────────┘
```

**Validation**:
- Title: 1-256 chars, not empty
- Description: 1-2048 chars, not empty
- Choices: 3-10 options, each not empty
- Duration: 1-30 days, end > start
- Form can't submit if validation fails

**On Submit**:
1. Call API: POST /dao/proposals
2. Show loading spinner
3. Redirect to ProposalDetailPage on success
4. Show error toast on failure

---

#### Component: Vote Transaction Modal

**Purpose**: Hiển thị transaction details, request user signature

```
┌────────────────────────────────────────┐
│ Confirm Your Vote                       │
├────────────────────────────────────────┤
│                                         │
│ Proposal: "Increase Reward Rate"        │
│ Your Choice: "Approve (Choice A)"       │
│ Voting Power: 1000 VNDC                 │
│ Status: ○ Tokens will be locked during  │
│         voting period                   │
│                                         │
│ Transaction Fee: ~0.001 ETH (estimated) │
│                                         │
│ [Sign with MetaMask] [Cancel]           │
│                                         │
│ Status: [PENDING] → [CONFIRMING] →      │
│         [CONFIRMED] → [LOCKED]          │
│                                         │
│ Transaction Hash:                       │
│ 0xabc...def (View on Etherscan)         │
└────────────────────────────────────────┘
```

**Flow**:
1. User clicks "Sign & Vote"
2. Modal appears
3. Show vote details
4. User clicks "Sign with MetaMask"
5. MetaMask popup appears
6. User signs message
7. Frontend submits vote to backend
8. Backend verifies signature, locks tokens on-chain
9. Modal shows "Transaction Confirmed"
10. Update proposal page to show vote

---

### 4.2 Data Flow Diagram

```
Frontend                          Backend                      Blockchain
─────────────────────────────────────────────────────────────────────

[DAO Dashboard]
       │
       ├─→ GET /dao/proposals
       │   (page, status, limit)
       │                          [DAO Service]
       │                          Get proposals from DB
       │                          ← [Proposals JSON]
       │
       └─ Display proposals

[Proposal Detail Page]
       │
       ├─→ GET /dao/proposals/:id
       │                          [DAO Service]
       │                          Get proposal + votes
       │                          ← [Proposal with breakdown]
       │
       └─ Display details

[User selects choice & voting power]
       │
       ├─→ Create EIP-712 message
       │   {proposalId, choiceId, votePower, nonce}
       │
       ├─→ Request MetaMask signature
       │   (User signs offline, no gas)
       │
       └─→ POST /dao/votes
           {proposalId, choiceId, votePower, signature}
                                  [DAO Handler]
                                  Verify EIP-712 signature
                                  Get voter balance (on-chain + pending)
                                  Check votePower ≤ balance
                                  │
                                  ├─→ [DAOManager.castVote()]
                                  │   Lock tokens
                                  │   Record vote on-chain
                                  │   ← Transaction sent
                                  │
                                  ├─ Save vote to MongoDB
                                  ├─ Create Transaction record
                                  ├─ Create VoteHistory record
                                  │
                                  ← {voteId, status: PENDING}
           │
           └─ Update UI: "Vote recorded, tokens locked"

[After voting period ends]
       │
       ← DAOAutoExecutionWorker ticks every 1 minute
           ├─ Query: proposals with voting_end <= now
           ├─ For each: call daoService.TallyVotes()
           ├─→ [DAOManager.tallyVotes()]
           │   Calculate winner
           │   ← Transaction sent
           ├─→ [DAOManager.unlockTokens(voters)]
           │   Unlock all voters' tokens
           │   ← Batch transaction sent
           ├─ Update proposal status → CLOSED
           ├─ Execute DAO action if applicable
           └─ Create VoteHistory entries

[User checks voting history]
       │
       ├─→ GET /dao/votes/my-history
       │                          [DAO Service]
       │                          Get user's votes with proposal context
       │                          ← [Votes with details]
       │
       └─ Display history
```

---

## 5. API Specifications

### 5.1 Request/Response Formats

#### POST /v1/dao/proposals

**Admin: Create new DAO proposal**

```
Request:
{
  "title": "Increase Activity Rewards to 0.2 VNDC",
  "description": "Proposed increase to incentivize student participation...",
  "choices": [
    "Approve (increase to 0.2)",
    "Keep current (0.1)",
    "Decrease to 0.05"
  ],
  "voting_start": "2026-05-21T10:00:00Z",  // ISO 8601
  "voting_end": "2026-05-23T10:00:00Z"     // Must be 1-30 days from start
}

Response (201 Created):
{
  "success": true,
  "data": {
    "proposal_id": "uuid-string",
    "title": "Increase Activity Rewards to 0.2 VNDC",
    "status": "DRAFT",
    "created_at": "2026-05-20T10:00:00Z",
    "voting_start": "2026-05-21T10:00:00Z",
    "voting_end": "2026-05-23T10:00:00Z",
    "creator": "0x1234...5678"
  }
}

Error Cases:
{
  "success": false,
  "error": {
    "code": "INVALID_VOTING_PERIOD",
    "message": "Voting period must be between 1 and 30 days"
  }
}
```

#### PATCH /v1/dao/proposals/:id/activate

**Admin: Activate proposal (start voting)**

```
Request: {} (empty body)

Response (200 OK):
{
  "success": true,
  "data": {
    "proposal_id": "uuid-string",
    "status": "ACTIVE",
    "voting_start": "2026-05-20T10:00:00Z",
    "voting_end": "2026-05-22T10:00:00Z",
    "tx_hash": "0xabc...def"
  }
}
```

#### POST /v1/dao/votes

**Student: Cast vote (token-weighted)**

```
Request:
{
  "proposal_id": "uuid-string",
  "choice_id": 0,                    // 0-based index in choices array
  "vote_power": "1000000000000000000", // Wei (1000 VNDC in wei)
  "signature": "0x...",              // EIP-712 signature (65 bytes)
  "nonce": 1                         // Incremented per vote by user
}

Response (201 Created):
{
  "success": true,
  "data": {
    "vote_id": "uuid-string",
    "proposal_id": "uuid-string",
    "voter": "0x1234...5678",
    "choice_id": 0,
    "vote_power": "1000000000000000000",
    "status": "CONFIRMED",
    "locked_amount": "1000000000000000000",
    "tx_hash": "0xabc...def",
    "created_at": "2026-05-20T10:15:00Z"
  }
}

Error Cases:
{
  "success": false,
  "error": {
    "code": "VOTE_ALREADY_CAST",
    "message": "User has already voted on this proposal"
  }
}
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Vote power 1000 VNDC exceeds balance 500 VNDC"
  }
}
{
  "success": false,
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "EIP-712 signature verification failed"
  }
}
```

#### GET /v1/dao/proposals/:id

**Get proposal details with vote breakdown**

```
Response (200 OK):
{
  "success": true,
  "data": {
    "proposal_id": "uuid",
    "title": "Increase Activity Rewards",
    "description": "...",
    "status": "ACTIVE",
    "creator": "0x1234...5678",
    "choices": [
      "Approve (0.2 VNDC)",
      "Keep current (0.1)",
      "Decrease (0.05)"
    ],
    "voting_start": "2026-05-20T10:00:00Z",
    "voting_end": "2026-05-22T10:00:00Z",
    "voting_remaining_seconds": 172800,
    
    "vote_breakdown": {
      "0": {
        "votes": "3000000000000000000000",  // 3000 VNDC wei
        "percentage": 60,
        "voter_count": 45
      },
      "1": {
        "votes": "1000000000000000000000",  // 1000 VNDC wei
        "percentage": 20,
        "voter_count": 25
      },
      "2": {
        "votes": "1000000000000000000000",
        "percentage": 20,
        "voter_count": 30
      }
    },
    
    "total_votes": "5000000000000000000000",
    "total_participants": 100,
    
    "current_user_vote": {
      "vote_id": "uuid",
      "choice_id": 0,
      "vote_power": "1000000000000000000000",
      "status": "CONFIRMED",
      "is_locked": true,
      "voted_at": "2026-05-20T10:15:00Z"
    },
    
    "is_voting_open": true,
    "can_user_vote": true,  // false if already voted
    
    "created_at": "2026-05-20T10:00:00Z"
  }
}
```

#### GET /v1/dao/votes/my-history

**Get user's voting history**

```
Response (200 OK):
{
  "success": true,
  "data": {
    "votes": [
      {
        "vote_id": "uuid-1",
        "proposal_id": "uuid-prop-1",
        "proposal_title": "Increase Rewards",
        "choice_id": 0,
        "choice_label": "Approve",
        "vote_power": "1000000000000000000000",
        "status": "CONFIRMED",
        "voted_at": "2026-05-20T10:15:00Z",
        "proposal_status": "CLOSED",
        "winning_choice": 0,  // User voted for winner
        "is_winning_vote": true
      },
      {
        "vote_id": "uuid-2",
        "proposal_id": "uuid-prop-2",
        "proposal_title": "Mint Bonus NFT",
        "choice_id": 1,
        "choice_label": "Later",
        "vote_power": "500000000000000000000",
        "status": "CONFIRMED",
        "voted_at": "2026-05-19T14:30:00Z",
        "proposal_status": "EXECUTED",
        "winning_choice": 0,
        "is_winning_vote": false
      }
    ],
    "statistics": {
      "total_votes_cast": 5,
      "successful_votes": 3,
      "failed_votes": 0,
      "total_vote_power": "10000000000000000000000",
      "avg_vote_power": "2000000000000000000000"
    }
  }
}
```

---

## 6. Database Schema

### 6.1 MongoDB Collections

#### Collection: `dao_proposals`

```javascript
db.createCollection("dao_proposals")

db.dao_proposals.createIndex({status: 1, voting_end: 1})
db.dao_proposals.createIndex({creator: 1, created_at: -1})
db.dao_proposals.createIndex({created_at: -1})

Document Schema:
{
  _id: "uuid-string",
  title: String,
  description: String,
  creator: String (wallet address),
  status: String ("DRAFT" | "ACTIVE" | "CLOSED" | "EXECUTED"),
  choices: [String],  // ["Option A", "Option B", ...]
  voting_start: Date,
  voting_end: Date,
  total_votes: Number (wei as integer or string),
  winning_choice: Number (choice index) | null,
  vote_breakdown: {
    "0": Number,  // Total votes for choice 0
    "1": Number,
    "2": Number,
    ...
  },
  execution_data: String | null,  // Encoded action based on winning choice
  executed_at: Date | null,
  execution_result: String | null,
  created_at: Date,
  updated_at: Date
}

Example:
{
  "_id": "uuid-123",
  "title": "Increase Activity Reward Rate",
  "description": "Proposed increase from 0.1 to 0.2 VNDC per point...",
  "creator": "0x1234...5678",
  "status": "CLOSED",
  "choices": [
    "Approve increase to 0.2 VNDC",
    "Keep current 0.1 VNDC",
    "Decrease to 0.05 VNDC"
  ],
  "voting_start": ISODate("2026-05-20T10:00:00Z"),
  "voting_end": ISODate("2026-05-22T10:00:00Z"),
  "total_votes": "5000000000000000000000",
  "winning_choice": 0,
  "vote_breakdown": {
    "0": "3000000000000000000000",
    "1": "1000000000000000000000",
    "2": "1000000000000000000000"
  },
  "executed_at": ISODate("2026-05-22T10:05:00Z"),
  "execution_result": "Token reward rate updated to 0.2 VNDC",
  "created_at": ISODate("2026-05-20T10:00:00Z"),
  "updated_at": ISODate("2026-05-22T10:05:00Z")
}
```

#### Collection: `dao_votes`

```javascript
db.createCollection("dao_votes")

db.dao_votes.createIndex({proposal_id: 1, voter: 1}, {unique: true})
db.dao_votes.createIndex({voter: 1, voted_at: -1})
db.dao_votes.createIndex({proposal_id: 1, status: 1})
db.dao_votes.createIndex({voted_at: -1})

Document Schema:
{
  _id: "uuid-string",
  proposal_id: String (foreign key),
  voter: String (wallet address, checksummed),
  choice_id: Number,
  vote_power: String (wei as string),
  status: String ("PENDING" | "CONFIRMED" | "UNLOCKED"),
  is_locked: Boolean,
  tx_hash: String | null,
  signature: String (EIP-712 signature),
  nonce: Number (prevent replay),
  voted_at: Date,
  confirmed_at: Date | null,
  unlocked_at: Date | null,
  created_at: Date
}

Example:
{
  "_id": "uuid-vote-1",
  "proposal_id": "uuid-123",
  "voter": "0xaaaa...bbbb",
  "choice_id": 0,
  "vote_power": "1000000000000000000000",
  "status": "CONFIRMED",
  "is_locked": true,
  "tx_hash": "0xabc...def",
  "signature": "0x...",
  "nonce": 1,
  "voted_at": ISODate("2026-05-20T10:15:00Z"),
  "confirmed_at": ISODate("2026-05-20T10:15:30Z"),
  "unlocked_at": null,
  "created_at": ISODate("2026-05-20T10:15:00Z")
}
```

#### Collection: `dao_vote_history` (Audit Trail)

```javascript
db.createCollection("dao_vote_history")

db.dao_vote_history.createIndex({proposal_id: 1, timestamp: -1})
db.dao_vote_history.createIndex({voter: 1, timestamp: -1})

Document Schema:
{
  _id: "uuid-string",
  proposal_id: String,
  voter: String | null,  // null for system actions (tally, unlock)
  action: String,  // "VOTE_CAST" | "VOTE_UPDATED" | "TALLY_COMPLETE" | "TOKENS_UNLOCKED" | "PROPOSAL_EXECUTED"
  choice_id: Number | null,
  vote_power: String | null,
  tx_hash: String | null,
  details: {
    proposal_title: String,
    old_value: any,  // for VOTE_UPDATED
    new_value: any,
    reason: String
  },
  timestamp: Date
}

Example (Vote Cast):
{
  "_id": "uuid-history-1",
  "proposal_id": "uuid-123",
  "voter": "0xaaaa...bbbb",
  "action": "VOTE_CAST",
  "choice_id": 0,
  "vote_power": "1000000000000000000000",
  "tx_hash": "0xabc...def",
  "details": {
    "proposal_title": "Increase Rewards",
    "choice_label": "Approve"
  },
  "timestamp": ISODate("2026-05-20T10:15:00Z")
}

Example (Tally Complete):
{
  "_id": "uuid-history-2",
  "proposal_id": "uuid-123",
  "voter": null,
  "action": "TALLY_COMPLETE",
  "details": {
    "total_votes": "5000000000000000000000",
    "winning_choice": 0,
    "breakdown": {"0": 3000, "1": 1000, "2": 1000},
    "participant_count": 100
  },
  "timestamp": ISODate("2026-05-22T10:05:00Z")
}
```

---

## 7. State Machines & Flows

### 7.1 Proposal State Machine

```
                    ┌─────────────────┐
                    │     DRAFT       │
                    │ (Can be edited) │
                    └────────┬────────┘
                             │
                      [Admin activates]
                             │
                    ┌────────▼────────┐
                    │     ACTIVE      │
                    │ (Voting ongoing)│
                    └────────┬────────┘
                             │
                    [votingEnd < now]
                             │
                    ┌────────▼────────┐
                    │     CLOSED      │
                    │  (Tally done)   │
                    └────────┬────────┘
                             │
                    [Execute DAO action]
                             │
                    ┌────────▼────────┐
                    │    EXECUTED     │
                    │  (Results done) │
                    └─────────────────┘
```

### 7.2 Vote State Machine

```
                    ┌──────────────────┐
                    │     PENDING      │
                    │ (Vote submitted) │
                    └────────┬─────────┘
                             │
                      [Block confirmed]
                             │
                    ┌────────▼─────────┐
                    │    CONFIRMED     │
                    │  (On-chain ok)   │
                    │ isLocked = true  │
                    └────────┬─────────┘
                             │
                    [votingEnd < now]
                    [tally executed]
                             │
                    ┌────────▼─────────┐
                    │    UNLOCKED      │
                    │ isLocked = false │
                    └──────────────────┘
```

### 7.3 Complete Voting Flow

```
ACTOR: Student
TRIGGER: User clicks "Vote"

┌─ Frontend
│  1. User selects choice + voting power
│  2. Create EIP-712 message:
│     {
│       proposalId: "uuid",
│       choiceId: 0,
│       votePower: "1000 VNDC in wei",
│       nonce: 1
│     }
│  3. Request MetaMask signature
│  4. User signs (OFFLINE, no gas)
│  5. Frontend sends POST /dao/votes
│     {
│       proposalId,
│       choiceId,
│       votePower,
│       signature,
│       nonce
│     }
│
├─ Backend (DAO Handler)
│  1. Receive POST /dao/votes
│  2. Extract signature, recover voter address
│  3. Verify EIP-712 signature
│  4. Query proposal: check status=ACTIVE
│  5. Check votingEnd >= now
│  6. Check !HasVoted(proposalId, voter)
│  7. Get voter balance = on_chain + pending
│  8. Verify votePower <= balance
│  9. Create transaction:
│     {
│       id: uuid,
│       type: "VOTE",
│       from: voter,
│       to: DAOManager,
│       amount: votePower,
│       contextType: "DAO_VOTE",
│       contextId: proposalId
│     }
│  10. Create Vote entity
│  11. Save vote to MongoDB
│  12. Submit backend to blockchain worker
│
├─ Blockchain Worker (Batch)
│  1. Collect pending votes (with other txs)
│  2. Build Merkle tree of votes
│  3. Submit batch to DAOManager.castVote(merkleProof)
│     [onchain cost: amortized to ~$0.001 per vote]
│
├─ Smart Contract (DAOManager)
│  1. Verify Merkle proof for vote
│  2. Lock tokens:
│     lockedTokens[proposalId][voter] = votePower
│     isVotingLocked[voter] = true
│  3. Record vote:
│     votes[proposalId][voter] = {choiceId, votePower}
│     choiceVotes[proposalId][choiceId] += votePower
│  4. Emit VoteCast(proposalId, voter, choiceId, votePower)
│
└─ Frontend
   1. Polling: Check TX status via /transactions/:id
   2. Once TX status = "CONFIRMED":
      Update UI to show "Vote recorded ✓"
      Show "Tokens locked" notice
   3. Update proposal vote breakdown
```

---

## 8. Worker Implementation

### 8.1 DAOAutoExecutionWorker Pseudocode

```go
DAOAutoExecutionWorker runs every 1 minute:

func (w *DAOAutoExecutionWorker) run() {
  for {
    select {
    case <-ticker.C:
      ctx := context.WithTimeout(30s)
      w.processDueProposals(ctx)
    case <-stopChan:
      return
    }
  }
}

func (w *DAOAutoExecutionWorker) processDueProposals(ctx) {
  // Step 1: Find proposals with voting ended
  proposals := daoProposalRepo.FindVotingEnded(ctx)
  // Returns: proposals where status=ACTIVE AND votingEnd <= now
  
  for proposal := proposals {
    if err := w.processProposal(ctx, proposal) {
      log.Error("failed to process proposal", proposal.ID, err)
      continue  // Continue processing other proposals
    }
  }
  
  log.Info("dao auto-execution tick completed", 
    "proposals_processed": len(proposals),
    "timestamp": now)
}

func (w *DAOAutoExecutionWorker) processProposal(ctx, proposal) {
  // Step 2: Tally votes
  log.Info("tallying votes", "proposal_id": proposal.ID)
  
  votes := daoVoteRepo.FindByProposal(ctx, proposal.ID)
  choiceVotes := calculateVoteBreakdown(votes)
  winner := findWinner(choiceVotes)  // max votes
  
  // Step 3: Update proposal in DB
  daoProposalRepo.Update(ctx, proposal.ID, {
    status: "CLOSED",
    winning_choice: winner,
    total_votes: sumVotes(votes),
    vote_breakdown: choiceVotes
  })
  
  // Step 4: Call Smart Contract to tally
  txHash := daoAdapter.TallyVotes(ctx, proposal.ID, winner)
  
  // Step 5: Create vote history (audit trail)
  voteHistory := VoteHistory{
    proposalID: proposal.ID,
    action: "TALLY_COMPLETE",
    details: {
      total_votes: choiceVotes,
      winner: winner,
      participant_count: len(votes)
    },
    timestamp: now
  }
  daoVoteHistoryRepo.Create(ctx, voteHistory)
  
  // Step 6: Unlock tokens
  log.Info("unlocking tokens", "proposal_id": proposal.ID, "voters": len(votes))
  
  voterAddresses := []string{}
  for vote := votes {
    voterAddresses.append(vote.VoterAddress)
  }
  
  unlockTxHash := daoAdapter.UnlockTokens(ctx, proposal.ID, voterAddresses)
  
  // Step 7: Update votes to UNLOCKED status
  for vote := votes {
    daoVoteRepo.Update(ctx, vote.ID, {
      status: "UNLOCKED",
      is_locked: false,
      unlocked_at: now
    })
    
    // Create history entry
    voteHistoryRepo.Create(ctx, VoteHistory{
      proposalID: proposal.ID,
      voter: vote.VoterAddress,
      action: "TOKENS_UNLOCKED",
      txHash: unlockTxHash,
      timestamp: now
    })
  }
  
  // Step 8: Execute DAO action based on winning choice
  log.Info("executing dao action", "proposal": proposal.ID, "choice": winner)
  
  executionResult := w.executeDAOAction(ctx, proposal, winner)
  // e.g., if choice = "Increase Reward Rate":
  //   - Update config parameter
  //   - Emit event
  //   - Return success/error
  
  // Step 9: Update proposal with execution result
  daoProposalRepo.Update(ctx, proposal.ID, {
    status: "EXECUTED",
    executed_at: now,
    execution_result: executionResult
  })
  
  // Step 10: Create final history entry
  voteHistoryRepo.Create(ctx, VoteHistory{
    proposalID: proposal.ID,
    action: "PROPOSAL_EXECUTED",
    details: {
      winning_choice: winner,
      execution_result: executionResult
    },
    timestamp: now
  })
  
  log.Info("proposal execution completed",
    "proposal_id": proposal.ID,
    "winner": winner,
    "result": executionResult)
}

func (w *DAOAutoExecutionWorker) executeDAOAction(ctx, proposal, choiceId) string {
  // Decode action based on choiceId and proposal context
  // Each DAO proposal type has different actions
  
  // Example 1: If proposal = "Increase Reward Rate"
  // choiceId=0 → "Approve" → Update tokenRewardRate
  if proposal.Title.contains("Increase") && choiceId == 0 {
    daoAdapter.UpdateRewardRate(ctx, 0.2)
    return "Token reward rate updated to 0.2 VNDC"
  }
  
  // Example 2: If proposal = "Mint Bonus NFT"
  // choiceId=0 → "Approve" → Trigger auto-mint
  if proposal.Title.contains("Bonus NFT") && choiceId == 0 {
    daoAdapter.MintBonusNFT(ctx)
    return "Bonus NFT minting triggered for all students"
  }
  
  // Example 3: Default (no execution needed)
  return "Proposal results recorded"
}

// Error handling
On any error in processProposal:
  - Log error with proposal ID
  - Create error history entry
  - Continue processing next proposal
  - Max retries: 3 per proposal (exponential backoff)
```

### 8.2 Worker Integration in main.go

```go
// After other workers are initialized:

daoAutoExecWorker := workers.NewDAOAutoExecutionWorker(
  daoProposalRepo,
  daoVoteRepo,
  daoVoteHistoryRepo,
  transactionRepo,
  daoAdapter,
  log,
)

go daoAutoExecWorker.Run(ctx)
log.Info("dao auto-execution worker started")

// On graceful shutdown:
daoAutoExecWorker.Stop()
```

---

## 9. Security & Error Handling

### 9.1 Security Considerations

#### 1. EIP-712 Signature Verification

```
Risks Mitigated:
  ✓ Replay attacks: Nonce incremented per vote
  ✓ Man-in-the-middle: Signature verifies message integrity
  ✓ Offline signing: No private keys exposed to backend
  
Implementation:
  - Backend recovers voter address from signature
  - Verify recovered address matches expected voter
  - Check nonce hasn't been used before
  - Verify message fields match request body
```

#### 2. Token Locking

```
Risks Mitigated:
  ✓ Double voting via token transfer: Tokens locked on-chain
  ✓ "Vote then unstake" attacks: Lock prevents unstaking
  ✓ Vote manipulation: Each token counts once per proposal
  
Mechanism:
  - On castVote(): lockedTokens[proposalId][voter] = votePower
  - Token transfers check: if isVotingLocked[voter] → reject
  - On voting end: unlockTokens() clears lock
  - Fallback: Auto-unlock after 7 days (safety net)
```

#### 3. Vote Integrity

```
Risks Mitigated:
  ✓ Front-running: Batch processing with Merkle tree
  ✓ Censorship: Each vote recorded immutably on-chain
  ✓ Vote duplication: Unique index (proposalId, voter)
  
Implementation:
  - Backend checks: !HasVoted(proposalId, voter)
  - Database unique constraint: (proposal_id, voter)
  - Smart contract: Revert if vote already exists
```

#### 9.2 Error Handling

#### Vote Submission Errors

```
Error: Invalid Signature
  Status: 400 Bad Request
  Action: Ask user to re-sign with correct account
  Log Level: Warn

Error: Insufficient Balance
  Status: 400 Bad Request
  Action: Show "Need X more tokens to vote"
  Log Level: Warn

Error: Already Voted
  Status: 409 Conflict
  Action: Show "You already voted in this proposal"
  Log Level: Info

Error: Voting Period Closed
  Status: 400 Bad Request
  Action: Show "Voting ended on [date]"
  Log Level: Warn

Error: Proposal Not Found
  Status: 404 Not Found
  Action: Show "Proposal doesn't exist"
  Log Level: Warn

Error: Blockchain RPC Failure
  Status: 503 Service Unavailable
  Action: Show "Temporary network issue, try again"
  Log Level: Error
  Retry: Auto-retry with exponential backoff
```

#### Tally/Unlock Errors

```
Error: No Votes Found
  Status: Log warning only
  Action: Mark proposal as executed with 0 votes
  Log Level: Warn

Error: Blockchain Submission Failed
  Status: Retry in next worker tick
  Action: Max 3 retries, then alert admin
  Log Level: Error
  
Error: Smart Contract Revert
  Status: Log error, mark as failed
  Action: Alert admin, require manual intervention
  Log Level: Error
```

### 9.3 Validation Rules

#### Proposal Creation

```
✓ title: 1-256 chars, not empty
✓ description: 1-2048 chars, not empty
✓ choices: 3-10 options, each 1-256 chars
✓ votingStart: >= now
✓ votingEnd: votingStart + 1 day to 30 days
✓ creator: valid Ethereum address
```

#### Vote Casting

```
✓ proposalId: exists in DB, status = ACTIVE
✓ choiceId: 0 <= choiceId < choices.length
✓ votePower: > 0 AND <= voter balance (on-chain + pending)
✓ signature: Valid EIP-712 signature
✓ nonce: Not used before for this voter
✓ voter: hasn't voted in this proposal already
✓ votingEnd: >= block.timestamp (still voting)
```

---

## 10. Testing & Deployment

### 10.1 Unit Tests

```
# Backend Tests

test/dao_service_test.go
├── CreateProposal_ValidInput_Success
├── CreateProposal_InvalidVotingPeriod_Error
├── CastVote_ValidSignature_Success
├── CastVote_AlreadyVoted_Error
├── CastVote_InsufficientBalance_Error
├── TallyVotes_CalculatesWinner_Correct
├── UnlockTokens_UpdatesAllVotes_Success

test/dao_repository_test.go
├── FindVotingEnded_ReturnsProposalsWithExpiredVoting
├── GetChoiceVotes_ReturnBreakdownPerChoice
├── HasVoted_ChecksDuplicateVotes

test/dao_worker_test.go
├── ProcessDueProposals_TalliesAndExecutes
├── HandleMultipleProposals_AllProcessed
└── ExponentialBackoff_RetriesOnFailure
```

### 10.2 Integration Tests

```
# End-to-end test: Complete DAO workflow

Integration Test: CompleteDAOVotingWorkflow
  1. Create proposal (admin)
  2. Activate proposal (admin)
  3. Verify active in frontend
  4. Cast votes from 5 students (various powers)
  5. Verify vote breakdown updates
  6. Fast-forward time past votingEnd
  7. DAOAutoExecutionWorker processes
  8. Verify proposal status → CLOSED
  9. Verify tokens unlocked
 10. Verify DAO action executed
 11. Verify audit trail recorded
 12. Assertions: All state consistent across DB + blockchain
```

### 10.3 Deployment Checklist

```
Pre-Deployment:
  ☐ All tests passing (unit + integration)
  ☐ Code review completed
  ☐ Security audit (signatures, locks)
  ☐ Database migrations prepared
  ☐ Smart contract audited
  ☐ Backend config reviewed
  ☐ Frontend UI tested on testnet
  
Deployment Steps:
  1. Deploy DAOManager.sol to testnet
  2. Update backend config with contract address
  3. Deploy backend with DAO workers
  4. Run database migrations:
     - Create dao_proposals collection + indexes
     - Create dao_votes collection + indexes
     - Create dao_vote_history collection + indexes
  5. Deploy frontend with DAO components
  6. Verify:
     - Backend health check: GET /health
     - Create test proposal
     - Cast test vote
     - Verify blockchain interaction
     - Check worker logs
  7. Notify stakeholders
  
Rollback Plan:
  - If critical bug: Disable DAO routes (feature flag)
  - If contract issue: Deploy new contract version
  - If DB issue: Restore from backup
  - Communicate status to users
```

---

## 📋 Implementation Checklist

### Phase 1: Smart Contract (On-Chain)
- [ ] DAOManager.sol implementation
- [ ] EIP-712 signature verification
- [ ] Token locking logic
- [ ] Vote tallying logic
- [ ] Unit tests for contract
- [ ] Security audit

### Phase 2: Backend (Off-Chain)
- [ ] Domain entities (Proposal, Vote, VoteHistory)
- [ ] Repository implementations (MongoDB)
- [ ] Service layer (DAOService)
- [ ] HTTP handlers (routes, validation, responses)
- [ ] Worker implementation (DAOAutoExecutionWorker)
- [ ] Integration into main.go
- [ ] Database migrations + indexes
- [ ] Unit tests
- [ ] Integration tests

### Phase 3: Frontend
- [ ] DAO Dashboard page
- [ ] Proposal Detail page
- [ ] Create Proposal page (admin)
- [ ] Vote Transaction modal
- [ ] Voting history component
- [ ] EIP-712 signing integration
- [ ] Real-time vote updates (polling/websocket)
- [ ] Error handling + user feedback
- [ ] Mobile responsiveness

### Phase 4: Integration & Testing
- [ ] End-to-end workflow test
- [ ] Performance testing (1000+ votes)
- [ ] Security testing (replay attacks, etc.)
- [ ] Load testing (concurrent votes)
- [ ] Deployment to testnet

---

## 📞 Contact & Escalation

**For Implementation Questions:**
- Architecture: @system_architect
- Frontend: @frontend_lead
- Backend: @backend_lead
- Smart Contracts: @solidity_dev
- QA: @qa_lead

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-20  
**Status**: Ready for Implementation  
**Next Review**: After Phase 1 completion
