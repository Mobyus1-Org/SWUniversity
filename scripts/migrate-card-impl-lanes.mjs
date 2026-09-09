// migrate-card-impl-lanes.mjs [--push]
//
// One-time migration for the /admin/cards-impl lane rename:
//
//   To Do / Priority / Needs Work / Done   ->   Not Implemented / To Do / Priority / Done
//
// Two things change in the database:
//
//   1. `needs-work` rows become `priority`. The lane is gone, and a card with a bug now goes back
//      to Priority (with its note intact) rather than to a separate holding lane. Each migrated
//      row is appended to the end of the Priority order.
//   2. Nothing else. "Not Implemented" is the DERIVED lane — a card with no row is in it — so the
//      ~448 untouched cards need no documents, exactly as they needed none before.
//
// A stored `todo` row now means the EXPLICIT To Do lane rather than "same as no row". There are
// currently none, so nothing is reinterpreted; if any existed they would simply show under To Do,
// which is the intended reading.
//
//   node scripts/migrate-card-impl-lanes.mjs           # dry run — reports, writes nothing
//   node scripts/migrate-card-impl-lanes.mjs --push    # apply
//
// Safe to re-run: it only ever matches rows still holding a retired status.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COLLECTION = "cardimplstatuses";
const push = process.argv.includes("--push");

function connectionString() {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    console.error("No .env at the repo root — cannot reach the database.");
    process.exit(1);
  }
  const line = fs.readFileSync(envPath, "utf8").split("\n")
    .find((l) => l.startsWith("MONGO_CONNECTION_STRING="));
  if (!line) {
    console.error("MONGO_CONNECTION_STRING is not set in .env.");
    process.exit(1);
  }
  return line.slice("MONGO_CONNECTION_STRING=".length).trim().replace(/^["']|["']$/g, "");
}

const { default: mongoose } = await import("mongoose");
await mongoose.connect(connectionString(), { bufferCommands: false });
const coll = mongoose.connection.db.collection(COLLECTION);

try {
  const stale = await coll.find({ status: "needs-work" }).toArray();
  const ranks = await coll.find({ status: "priority" }).toArray();
  const maxRank = ranks.reduce((m, r) => Math.max(m, r.priorityRank ?? 0), 0);

  console.log(`${stale.length} row(s) still on the retired "needs-work" lane:`);
  for (const r of stale) console.log(`  ${r.cardId}${r.note ? `  — ${r.note}` : ""}`);
  console.log(`\nHighest Priority rank in use: ${maxRank}`);

  if (stale.length === 0) {
    console.log("\nNothing to migrate.");
  } else if (!push) {
    console.log("\nDry run — nothing written. Re-run with --push to apply.");
  } else {
    let rank = maxRank;
    for (const r of stale) {
      rank += 1;
      await coll.updateOne(
        { cardId: r.cardId },
        { $set: { status: "priority", priorityRank: rank, updatedAt: new Date() } },
      );
      console.log(`  ${r.cardId} -> priority (rank ${rank})`);
    }
    console.log(`\nMigrated ${stale.length} row(s).`);
  }
} finally {
  await mongoose.disconnect();
}
