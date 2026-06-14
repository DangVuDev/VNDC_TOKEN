# VNDC Off-chain Transaction Flow

File nay gom cac so do Mermaid de hinh dung luong xu ly transaction trong backend `offchain/backend-go`.

Nguon code chinh:

- API transaction: `internal/application/transaction/handler.go`
- Service transaction: `internal/application/transaction/service.go`
- Domain transaction/batch: `internal/domain/entities.go`
- Mongo repository: `internal/adapters/mongodb/repos.go`
- Worker trigger: `internal/workers/token_transfer_worker.go`
- Worker settlement: `internal/workers/batch_worker.go`
- Smart contract adapter: `pkg/blockchain/token_contract.go`
- Wiring startup: `cmd/server/app_runner.go`, `cmd/server/workers_setup.go`, `cmd/server/blockchain_setup.go`

## 1. Use Case Tong Quan

```mermaid
flowchart LR
    %% Actors
    User["User / Wallet holder"]
    Admin["Admin / Operator"]
    Biz["Business modules<br/>Fundraising / Marketplace / Ticketing / Event"]
    Timer["Background timer<br/>Ticker / Change Stream"]
    Relayer["Backend relayer key"]
    Chain["VNDCToken smart contract"]

    %% System boundary
    subgraph Backend["VNDC Backend Off-chain System"]
        Auth["Authenticate JWT wallet"]
        Submit["Submit signed transfer<br/>POST /v1/transactions/transfer"]
        Validate["Validate transfer intent<br/>deadline / amount / address"]
        VerifySig["Verify EIP-712 signature"]
        CheckKYC["Check KYC"]
        CheckBalance["Check on-chain balance<br/>minus pending DB amount"]
        QueueTx["Queue Mongo transaction<br/>status = PENDING"]
        ViewTx["View transaction history/detail"]
        CancelTx["Cancel pending transaction"]
        Watch["Watch transactions collection<br/>Change Stream or polling"]
        Batch["Build settlement batch"]
        Settle["Submit transferWithSignature<br/>through token adapter"]
        Reconcile["Update batch + transactions<br/>SUCCESS / FAILED"]
        BizHooks["Post-settlement hooks<br/>funding / marketplace / ticketing"]
    end

    User --> Auth --> Submit
    Submit --> Validate --> VerifySig --> CheckKYC --> CheckBalance --> QueueTx
    User --> ViewTx
    User --> CancelTx

    Biz --> Submit
    Timer --> Watch --> Batch --> Settle
    Relayer --> Settle
    Settle --> Chain
    Chain --> Settle --> Reconcile --> BizHooks
    Admin --> ViewTx

    classDef actor fill:#f8fafc,stroke:#334155,color:#0f172a
    classDef api fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e
    classDef worker fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef chain fill:#dcfce7,stroke:#15803d,color:#14532d

    class User,Admin,Biz,Timer,Relayer actor
    class Submit,ViewTx,CancelTx,Auth api
    class Watch,Batch,Reconcile,BizHooks worker
    class Chain,Settle chain
```

Chu thich:

- User path truc tiep bat dau tu `POST /v1/transactions/transfer`.
- Business modules cung co the tao transaction bang cach goi `transaction.Service.SubmitTransfer`.
- API chi tao record `PENDING`; viec len chain do worker xu ly bat dong bo.
- Relayer key nam trong backend ky gas transaction khi goi smart contract.

## 2. State Diagram Transaction

```mermaid
stateDiagram-v2
    [*] --> PENDING: SubmitTransfer thanh cong\nluu vao Mongo transactions

    PENDING --> ROLLED_BACK: User huy khi chua settle\nDELETE /v1/transactions/:id
    PENDING --> FAILED: Signature hex loi\nhoac batch submit fail
    PENDING --> BATCHED: BatchWorker.AssignBatch\nhien code set status = "batched"

    BATCHED --> SUCCESS: transferWithSignature mined OK\ncap nhat tx_hash, batch_id, settled_at
    BATCHED --> FAILED: submitWithRetry het retry\nmarkBatchFailed

    SUCCESS --> [*]: Terminal
    FAILED --> [*]: Terminal
    ROLLED_BACK --> [*]: Terminal

    note right of PENDING
        Domain dinh nghia:
        PENDING, QUEUED, PROCESSING,
        SUCCESS, FAILED, ROLLED_BACK
    end note

    note right of BATCHED
        Luu y code hien tai:
        AssignBatch set status = "batched"
        nhung domain khong khai bao status nay.
        Co the nen doi thanh PROCESSING
        hoac them status BATCHED ro rang.
    end note
```

Chu thich:

- `PENDING`: transaction da qua validate va dang cho worker settle.
- `BATCHED`: trang thai thuc te do repository ghi vao DB hien tai la lowercase `"batched"`.
- `SUCCESS`: smart contract call thanh cong va worker da update DB.
- `FAILED`: smart contract revert, send tx fail, het retry, hoac payload loi.
- `ROLLED_BACK`: user cancel truoc khi worker settle.

## 3. Sequence API Submit Transfer

```mermaid
sequenceDiagram
    autonumber
    actor User as User Wallet
    participant HTTP as Gin Handler<br/>transaction/handler.go
    participant Svc as Transaction Service<br/>transaction/service.go
    participant UserRepo as UserRepository
    participant TxRepo as TransactionRepository<br/>Mongo transactions
    participant Token as TokenContractPort<br/>VNDCToken adapter
    participant Cache as BalanceCache

    User->>HTTP: POST /v1/transactions/transfer<br/>from, to, amount, nonce, deadline, signature
    HTTP->>HTTP: Check authenticated wallet == from_wallet
    HTTP->>Svc: SubmitTransfer(req)

    Svc->>Svc: Validate deadline, amount, addresses
    Svc->>Svc: Build EIP-712 TransferData
    Svc->>Svc: VerifySignature(domain, data, signature, from)
    Svc->>TxRepo: HasActiveNonce(from, nonce)
    TxRepo-->>Svc: true / false
    Svc->>UserRepo: FindByWallet(from)
    UserRepo-->>Svc: user with KYC status

    alt User chua KYC hoac nonce trung
        Svc-->>HTTP: error
        HTTP-->>User: 4xx
    else Hop le
        Svc->>Token: BalanceOf(from)
        Token-->>Svc: on-chain balance
        Svc->>TxRepo: FindByStatus(PENDING/QUEUED/PROCESSING)
        TxRepo-->>Svc: active pending txs
        Svc->>Svc: available = onChain - pendingAmount

        alt Khong du available balance
            Svc-->>HTTP: ErrInsufficientBalance
            HTTP-->>User: 400/422
        else Du balance
            Svc->>Cache: Set pending/available snapshot
            Svc->>TxRepo: Create(Transaction{status=PENDING})
            TxRepo-->>Svc: created
            Svc-->>HTTP: Transaction record
            HTTP-->>User: 201 Created
        end
    end
```

Chu thich:

- Service verify chu ky off-chain truoc khi ghi DB.
- Balance check doc chain bang `BalanceOf`, sau do tru pending dang active trong DB.
- API khong goi `transferWithSignature` truc tiep; no chi queue transaction.

## 4. Logic Que Database Va Trigger Worker

```mermaid
flowchart TD
    Start["Server startup<br/>cmd/server/app_runner.go"] --> InitContract["initTokenContractAdapter<br/>blockchain_setup.go"]
    InitContract --> HasContract{"tokenContractPort != nil?"}

    HasContract -- "No" --> Disabled["Disable batch settlement worker<br/>log warning"]
    HasContract -- "Yes" --> CreateWorkers["startBackgroundWorkers<br/>workers_setup.go"]

    CreateWorkers --> TTW["TokenTransferWorker<br/>watch transactions collection"]
    CreateWorkers --> BW["BatchWorker<br/>periodic batch settlement"]
    TTW --> Mode{"Mongo supports Change Stream?"}

    Mode -- "Yes: replica set / Atlas" --> CS["Open Change Stream<br/>match insert/update status=PENDING"]
    Mode -- "No: standalone local Mongo" --> PollOnly["Fallback to interval polling only"]

    CS --> Count["CountByStatus(PENDING)"]
    Count --> Threshold{"pending count >= threshold?"}
    Threshold -- "Yes" --> Fire["fire trigger channel"]
    Threshold -- "No" --> Wait["Wait next event/tick"]

    PollOnly --> Tick["TriggerInterval ticker"]
    Tick --> Fire
    Fire --> BW
    BW --> Process["processBatch()"]

    classDef startup fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e
    classDef worker fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef decision fill:#f8fafc,stroke:#475569,color:#0f172a

    class Start,InitContract,CreateWorkers startup
    class TTW,BW,CS,PollOnly,Count,Fire,Tick,Process worker
    class HasContract,Mode,Threshold decision
```

Chu thich:

- `TokenTransferWorker` khong settle transaction. No chi phat tin hieu de `BatchWorker` chay som.
- Neu Mongo khong phai replica set, Change Stream khong dung duoc; worker van chay bang ticker.
- Collection duoc watch trong code la `transactions`.

## 5. Batch Settlement Logic

```mermaid
flowchart TD
    A["BatchWorker.processBatch()"] --> B["FindByStatus(PENDING, batchSize)<br/>scan Mongo transactions"]
    B --> C{"Co pending tx?"}
    C -- "No" --> Z["Return nil"]
    C -- "Yes" --> D["Build transfers[]<br/>parse signature hex<br/>sum total amount"]

    D --> E{"Tx nao signature loi?"}
    E -- "Yes" --> E1["Mark tx FAILED<br/>handlePostFailure()"]
    E1 --> D
    E -- "No / con tx hop le" --> F["Create Batch record<br/>status=PENDING"]

    F --> G["AssignBatch(txIDs, batchID)<br/>link batch_id + set status"]
    G --> H["submitWithRetry(batchID, transfers)"]
    H --> I["token.BatchTransfer(transfers)"]
    I --> J["Loop tung transfer"]
    J --> K["sendTransferWithSignature<br/>pack ABI transferWithSignature"]
    K --> L["sendTx<br/>nonce, gas, sign relayer, SendTransaction, WaitMined"]

    L --> M{"All submitted OK?"}
    M -- "No" --> N["markBatchFailed<br/>Batch FAILED<br/>Tx FAILED<br/>post failure hooks"]
    M -- "Yes" --> O["updateBatchConfirmed<br/>Batch CONFIRMED + tx_hash"]
    O --> P["updateTxSuccess<br/>Tx SUCCESS + tx_hash + settled_at"]
    P --> Q["handlePostSettlement<br/>funding / marketplace / ticketing"]
    Q --> R["Invalidate + refresh balance cache<br/>BalanceOf(from/to)"]
    R --> S["Done"]

    classDef db fill:#ede9fe,stroke:#7c3aed,color:#3b0764
    classDef chain fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef fail fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    classDef ok fill:#ecfccb,stroke:#65a30d,color:#365314

    class B,F,G,O,P db
    class I,J,K,L,R chain
    class E1,N fail
    class S ok
```

Chu thich:

- `BatchTransfer` trong adapter hien tai goi tung `transferWithSignature`, khong phai mot Solidity batch function.
- `tx_hash` luu lai la hash cuoi cung ma `BatchTransfer` tra ve.
- Sau settlement thanh cong, worker goi cac hook nghiep vu theo `tx.Type`.

## 6. Smart Contract Interaction Detail

```mermaid
sequenceDiagram
    autonumber
    participant BW as BatchWorker
    participant Port as TokenContractPort
    participant Adapter as TokenContractAdapter<br/>pkg/blockchain/token_contract.go
    participant Eth as Ethereum RPC
    participant Contract as VNDCToken.sol

    BW->>Port: BatchTransfer(transfers)
    Port->>Adapter: BatchTransfer(transfers)

    loop For each TransferCall
        Adapter->>Adapter: parseTransferParams(from,to,amount,nonce)
        Adapter->>Adapter: abi.Pack("transferWithSignature", ...)
        Adapter->>Eth: PendingNonceAt(relayer)
        Adapter->>Eth: SuggestGasPrice()
        Adapter->>Eth: EstimateGas(callData)
        Adapter->>Adapter: SignTx(relayer private key)
        Adapter->>Eth: SendTransaction(signedTx)
        Eth->>Contract: transferWithSignature(from,to,amount,nonce,deadline,signature)
        Contract-->>Eth: receipt status
        Eth-->>Adapter: WaitMined receipt
        Adapter-->>Port: tx hash or error
    end

    Port-->>BW: last tx hash or first error
```

Chu thich:

- User ky EIP-712 signature cho payload transfer.
- Backend relayer ky Ethereum transaction de tra gas.
- Contract verify signature/nonce/deadline o on-chain layer.
- Adapter wait mined, neu receipt failed thi tra loi ve worker.

## 7. Post-settlement Business Hooks

```mermaid
flowchart TD
    A["Tx SUCCESS sau batch settlement"] --> B{"tx.Type"}

    B -- "TOKEN_TRANSFER" --> T["Khong co hook nghiep vu rieng<br/>chi update tx + balance cache"]

    B -- "FUND_CONTRIBUTION" --> F1["handleFundingContribution"]
    F1 --> F2["funding.RecordContribution<br/>FundingManager contract"]
    F2 --> F3["fundSync.FinalizeContributionSettlement<br/>update off-chain ledger"]

    B -- "MARKETPLACE_BUY" --> M1["handleMarketplacePurchase"]
    M1 --> M2{"Listing la NFT va co on-chain listing?"}
    M2 -- "No" --> M3["Update purchase payment hash<br/>status Pending COD"]
    M2 -- "Yes" --> M4["market.FinalizeSale<br/>MarketplaceManager contract"]
    M4 --> M5["Update purchase completed<br/>listing sold"]

    B -- "SERVICE_TICKET_BUY" --> S1["handleServiceTicketPurchase"]
    S1 --> S2["Move reserved stock to sold stock"]
    S2 --> S3["Update purchase completed<br/>payment_tx_hash=batchTxHash"]

    classDef chain fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef db fill:#ede9fe,stroke:#7c3aed,color:#3b0764
    class F2,M4 chain
    class F3,M3,M5,S2,S3 db
```

Chu thich:

- Cung mot pipeline transaction co the phuc vu chuyen token thuong, dong gop fund, mua marketplace, mua ticket.
- `ContextType`, `ContextID`, `ContextRef` trong transaction giup worker biet can update entity nghiep vu nao.

## 8. Cac Worker Khac Co Que Database Va Goi Contract

```mermaid
flowchart TD
    subgraph MainTx["Main transaction settlement"]
        T1["transactions PENDING"] --> T2["BatchWorker"]
        T2 --> T3["VNDCToken.transferWithSignature"]
    end

    subgraph DAO["DAO worker"]
        D1["FindExpiredActive proposals"] --> D2["Resolve quorum + vote result"]
        D2 --> D3["DAOManager.QueueProposal"]
        D3 --> D4["After ETA: DAOManager.ExecuteProposal"]
    end

    subgraph Reward["Reward processing worker"]
        R1["FindPending rewards"] --> R2["Check TaskManager pool"]
        R2 --> R3["TaskManager.ClaimReward"]
        R3 --> R4["Create SUCCESS transaction history"]
    end

    subgraph Campaign["Campaign worker"]
        C1["FindExpiredActive campaigns"] --> C2{"Success?"}
        C2 -- "Yes" --> C3["SubmitTransfer distribution"]
        C2 -- "No" --> C4["SubmitTransfer refunds"]
        C3 --> T1
        C4 --> T1
    end
```

Chu thich:

- Transaction settlement chinh: `TokenTransferWorker` + `BatchWorker`.
- DAO worker doc proposal/vote DB va goi DAO smart contract.
- Reward worker doc reward pending DB va goi TaskManager contract truc tiep, sau do tao transaction history status `SUCCESS`.
- Campaign worker khong goi contract truc tiep; no tao transaction moi qua `SubmitTransfer`, roi pipeline chinh settle sau.

## 9. Noi Nen Bat Dau Khi Debug

```mermaid
flowchart LR
    A["Transfer submit fail"] --> A1["transaction/service.go<br/>SubmitTransfer"]
    A --> A2["EIP-712 domain/config<br/>blockchain_setup.go"]
    A --> A3["KYC/user repo"]

    B["Tx nam PENDING qua lau"] --> B1["token_transfer_worker.go<br/>Change Stream / polling"]
    B --> B2["batch_worker.go<br/>processBatch"]
    B --> B3["workers_setup.go<br/>tokenContractPort nil?"]

    C["On-chain tx fail"] --> C1["token_contract.go<br/>sendTransferWithSignature"]
    C --> C2["Relayer private key / gas / nonce"]
    C --> C3["Contract revert<br/>signature, nonce, deadline, balance"]

    D["Balance hien sai"] --> D1["transaction/service.go<br/>computePendingAmount"]
    D --> D2["BalanceCache adapter"]
    D --> D3["BatchWorker refresh BalanceOf"]
```

