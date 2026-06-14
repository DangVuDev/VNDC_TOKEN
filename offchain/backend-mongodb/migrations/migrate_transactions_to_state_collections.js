// One-time migration from legacy `transactions` into state-split collections.
// Safe to rerun: documents are upserted by _id.

const pendingStatuses = ["PENDING", "QUEUED"];
const processingStatuses = ["PROCESSING", "batched", "BATCHED"];
const finalStatuses = ["SUCCESS", "FAILED", "ROLLED_BACK", "CANCELLED", "EXPIRED"];

function copyByStatus(statuses, targetName, normalizeStatus) {
  const target = db.getCollection(targetName);
  const cursor = db.transactions.find({ status: { $in: statuses }, deleted_at: null });
  let count = 0;
  cursor.forEach((doc) => {
    if (normalizeStatus) {
      doc.status = normalizeStatus(doc.status);
    }
    target.replaceOne({ _id: doc._id }, doc, { upsert: true });
    count += 1;
  });
  print(`${targetName}: migrated ${count} transactions`);
}

copyByStatus(pendingStatuses, "tx_pending");
copyByStatus(processingStatuses, "tx_processing", () => "PROCESSING");
copyByStatus(finalStatuses, "tx_final", (status) => status === "ROLLED_BACK" ? "CANCELLED" : status);

print("Legacy transactions collection was left untouched for rollback/read compatibility.");
