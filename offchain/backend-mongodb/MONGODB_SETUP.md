# 📦 MongoDB Schema & Configuration

## Collections Overview

VNDC uses MongoDB with 3 main collections:

### 1. transactions_queue
```javascript
db.createCollection("transactions_queue", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["from_address", "to_address", "amount", "signature", "nonce", "status"],
      properties: {
        _id: { bsonType: "objectId" },
        from_address: { 
          bsonType: "string",
          pattern: "^0x[a-fA-F0-9]{40}$"
        },
        to_address: { 
          bsonType: "string",
          pattern: "^0x[a-fA-F0-9]{40}$"
        },
        amount: { 
          bsonType: "string",  // BigInt as string
          description: "Amount in wei"
        },
        signature: { 
          bsonType: "string",
          minLength: 130,  // 0x + 65 bytes * 2
          maxLength: 132
        },
        nonce: { bsonType: "long" },
        status: { 
          enum: ["PENDING", "PROCESSING", "SUCCESS", "FAILED"],
          default: "PENDING"
        },
        batch_id: { bsonType: ["objectId", "null"] },
        tx_hash: { bsonType: ["string", "null"] },
        error_message: { bsonType: ["string", "null"] },
        retry_count: { bsonType: "int", default: 0 },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
        processed_at: { bsonType: ["date", "null"] }
      }
    }
  }
});

// Indexes
db.transactions_queue.createIndex({ from_address: 1, nonce: 1 });
db.transactions_queue.createIndex({ status: 1, created_at: -1 });
db.transactions_queue.createIndex({ batch_id: 1 });
db.transactions_queue.createIndex({ to_address: 1 });
db.transactions_queue.createIndex({ tx_hash: 1 }, { sparse: true });
db.transactions_queue.createIndex(
  { created_at: 1 },
  { expireAfterSeconds: 2592000 }  // 30 days TTL
);
```

### 2. batches
```javascript
db.createCollection("batches", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["batch_number", "total_amount", "transaction_ids", "status"],
      properties: {
        _id: { bsonType: "objectId" },
        batch_number: { bsonType: "long" },
        total_transactions: { bsonType: "int" },
        total_amount: { bsonType: "string" },
        transaction_ids: { 
          bsonType: "array",
          items: { bsonType: "objectId" }
        },
        status: { 
          enum: ["CREATED", "SUBMITTED", "CONFIRMED", "FAILED"],
          default: "CREATED"
        },
        blockchain: {
          bsonType: "object",
          properties: {
            tx_hash: { bsonType: ["string", "null"] },
            block_number: { bsonType: ["long", "null"] },
            confirmations: { bsonType: ["int", "null"] },
            gas_used: { bsonType: ["string", "null"] },
            gas_price: { bsonType: ["string", "null"] }
          }
        },
        created_at: { bsonType: "date" },
        submitted_at: { bsonType: ["date", "null"] },
        confirmed_at: { bsonType: ["date", "null"] }
      }
    }
  }
});

// Indexes
db.batches.createIndex({ batch_number: 1 }, { unique: true });
db.batches.createIndex({ status: 1, created_at: -1 });
db.batches.createIndex({ "blockchain.tx_hash": 1 }, { sparse: true });
```

### 3. users_balance
```javascript
db.createCollection("users_balance", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["wallet_address"],
      properties: {
        _id: { bsonType: "objectId" },
        wallet_address: { 
          bsonType: "string",
          pattern: "^0x[a-fA-F0-9]{40}$"
        },
        on_chain_balance: { 
          bsonType: "string",
          description: "Latest balance from blockchain in wei"
        },
        last_synced: { bsonType: "date" },
        total_received: { bsonType: "string", default: "0" },
        total_sent: { bsonType: "string", default: "0" },
        transaction_count: { bsonType: "long", default: 0 },
        created_at: { bsonType: "date" }
      }
    }
  }
});

// Indexes
db.users_balance.createIndex({ wallet_address: 1 }, { unique: true });
db.users_balance.createIndex({ last_synced: 1 });
```

### 4. nfts (Optional)
```javascript
db.createCollection("nfts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      properties: {
        _id: { bsonType: "objectId" },
        token_id: { bsonType: "string" },
        owner: { bsonType: "string" },
        type: { enum: ["CERTIFICATE", "BADGE", "ACHIEVEMENT"] },
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

## Setup Instructions

### 1. Local Development
```bash
# Install MongoDB locally
# macOS:
brew tap mongodb/brew
brew install mongodb-community

# Windows: Download from https://www.mongodb.com/try/download/community

# Start MongoDB
mongod --dbpath /path/to/data

# Connect to MongoDB
mongo --port 27017

# Create database & collections
use vndc_db
db.createCollection("transactions_queue")
db.createCollection("batches")
db.createCollection("users_balance")
db.createCollection("nfts")

# Create user for app
db.createUser({
  user: "vndc_app",
  pwd: "strong_password_here",
  roles: [
    { role: "readWrite", db: "vndc_db" }
  ]
})
```

### 2. Production (MongoDB Atlas)
```bash
# 1. Create cluster on https://www.mongodb.com/cloud/atlas
# 2. Whitelist IP address
# 3. Create database user
# 4. Get connection string: mongodb+srv://user:pwd@cluster.mongodb.net/vndc_db

# Connection string format:
# mongodb+srv://vndc_app:password@cluster0.xxxxx.mongodb.net/vndc_db?retryWrites=true&w=majority

# Add to .env:
MONGODB_URI=mongodb+srv://vndc_app:password@cluster.mongodb.net/vndc_db
```

### 3. Docker
```dockerfile
# Docker Compose for development
version: '3.8'

services:
  mongo:
    image: mongo:latest
    container_name: vndc-mongo
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: vndc_db
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
      - ./init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js
    networks:
      - vndc-network

  redis:
    image: redis:latest
    container_name: vndc-redis
    ports:
      - "6379:6379"
    networks:
      - vndc-network

  vndc-backend:
    build: ./offchain/backend-go
    container_name: vndc-backend
    depends_on:
      - mongo
      - redis
    environment:
      MONGODB_URI: mongodb://admin:password@mongo:27017/vndc_db
      REDIS_URL: redis://redis:6379
      PORT: 8080
    ports:
      - "8080:8080"
    networks:
      - vndc-network

volumes:
  mongo_data:

networks:
  vndc-network:
    driver: bridge
```

### 4. Backup & Restore
```bash
# Backup
mongodump --uri "mongodb://user:pwd@localhost:27017/vndc_db" --out ./backup

# Restore
mongorestore --uri "mongodb://user:pwd@localhost:27017/vndc_db" ./backup/vndc_db

# Cloud backup
# Atlas handles automatic backups
# Manual restore from Atlas UI
```

## Query Examples (Go)

```go
import "go.mongodb.org/mongo-driver/mongo"
import "go.mongodb.org/mongo-driver/bson"

// Find pending transactions
filter := bson.M{"status": "PENDING"}
opts := options.Find().SetSort(bson.M{"created_at": 1})
cursor, _ := collection.Find(ctx, filter, opts)

// Insert transaction
doc := bson.M{
  "from_address": "0x...",
  "to_address": "0x...",
  "amount": "1000000000000000000",
  "signature": "0x...",
  "nonce": 5,
  "status": "PENDING",
  "created_at": time.Now(),
}
result, _ := collection.InsertOne(ctx, doc)

// Update status
filter := bson.M{"_id": objectID}
update := bson.M{"$set": bson.M{"status": "SUCCESS", "processed_at": time.Now()}}
collection.UpdateOne(ctx, filter, update)

// Aggregation: Get user stats
pipeline := []bson.M{
  {"$match": bson.M{"from_address": "0x..."}},
  {"$group": bson.M{
    "_id": "$from_address",
    "total_sent": bson.M{"$sum": "$amount"},
    "tx_count": bson.M{"$sum": 1},
  }},
}
cursor, _ := collection.Aggregate(ctx, pipeline)
```

## Performance Tuning

1. ✅ Create indexes on frequently queried fields
2. ✅ Use projection to fetch only needed fields
3. ✅ Set TTL on transactions_queue (auto-delete old records)
4. ✅ Use connection pooling (default: 100 connections)
5. ✅ Monitor slow queries with MongoDB profiler

---

**Next**: Initialize MongoDB in local/production environment
