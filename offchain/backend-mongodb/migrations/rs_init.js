// rs_init.js — initialise a single-node replica set on first boot.
// This script runs before 001_init_collections.js via the
// docker-entrypoint-initdb.d/ convention.
// It is idempotent: if the replica set is already configured it does nothing.
try {
  const status = rs.status();
  print("Replica set already initialised: " + status.set);
} catch (e) {
  print("Initialising replica set rs0 ...");
  const result = rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "localhost:27017" }],
  });
  print(JSON.stringify(result));
}
