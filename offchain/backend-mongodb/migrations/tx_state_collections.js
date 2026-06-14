// State-split transaction collections for the off-chain settlement pipeline.
// Run inside the VNDC database, for example:
// mongosh "$MONGODB_URI/vndc_db" offchain/backend-mongodb/migrations/tx_state_collections.js

db.createCollection("tx_pending");
db.createCollection("tx_processing");
db.createCollection("tx_final");
db.createCollection("tx_sessions");
db.createCollection("tx_events");

db.tx_pending.createIndex({ status: 1, created_at: 1 });
db.tx_pending.createIndex(
  { from_wallet: 1, nonce: 1 },
  { unique: true, partialFilterExpression: { nonce: { $gt: "" } } }
);
db.tx_pending.createIndex({ deadline: 1 });
db.tx_pending.createIndex({ context_type: 1, context_id: 1 });

db.tx_processing.createIndex({ batch_id: 1, created_at: 1 });
db.tx_processing.createIndex(
  { from_wallet: 1, nonce: 1 },
  { unique: true, partialFilterExpression: { nonce: { $gt: "" } } }
);
db.tx_processing.createIndex({ tx_hash: 1 }, { sparse: true });
db.tx_processing.createIndex({ context_type: 1, context_id: 1 });

db.tx_final.createIndex({ from_wallet: 1, created_at: -1 });
db.tx_final.createIndex({ to_wallet: 1, created_at: -1 });
db.tx_final.createIndex({ status: 1, created_at: -1 });
db.tx_final.createIndex({ batch_id: 1 });
db.tx_final.createIndex({ tx_hash: 1 }, { sparse: true });
db.tx_final.createIndex({ context_type: 1, context_id: 1 });

db.tx_sessions.createIndex({ status: 1, created_at: -1 });
db.tx_sessions.createIndex({ owner: 1, status: 1 });
db.tx_sessions.createIndex({ chain_batch_id: 1 }, { unique: true, sparse: true });
db.tx_sessions.createIndex({ expires_at: 1 });

db.tx_events.createIndex({ chain_tx_hash: 1, log_index: 1 }, { unique: true });
db.tx_events.createIndex({ batch_id: 1, tx_id: 1 });
db.tx_events.createIndex({ created_at: -1 });
