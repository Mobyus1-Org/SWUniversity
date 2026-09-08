#!/usr/bin/env node
/**
 * Read the /admin/cards-impl board straight out of MongoDB.
 *
 *   node tests/tools/card-impl-board.mjs                    # counts per lane
 *   node tests/tools/card-impl-board.mjs --lane priority    # what's queued, in rank order
 *   node tests/tools/card-impl-board.mjs --lane needs-work  # with the note on each card
 *   node tests/tools/card-impl-board.mjs --set HMW
 *   node tests/tools/card-impl-board.mjs --lane priority --ids      # bare ids, for piping
 *   node tests/tools/card-impl-board.mjs --out /tmp/board.json
 *
 * STRICTLY READ-ONLY. It connects to the live database, so it only ever issues `find`, and it
 * never prints the connection string. To CHANGE a card's lane use card-impl.mjs, which goes
 * through the admin HTTP endpoint — see rule 1 in ./README.md.
 *
 * Card titles are joined in from the generated card database so the output is readable; the board
 * itself stores nothing but ids.
 *
 * Must be run from the repo root: it resolves `mongoose` from the repo's node_modules.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED = path.join(REPO_ROOT, "src/server/engine/card-db/generated.ts");

/** Mongoose lower-cases and pluralises the model name — must match CardImplStatusModel. */
const COLLECTION = "cardimplstatuses";
const LANES = ["todo", "priority", "needs-work", "done"];

/** Reads the URI without ever echoing it. */
function connectionString() {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    console.error("No .env at the repo root — cannot reach the database.");
    process.exit(1);
  }
  const line = fs.readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("MONGO_CONNECTION_STRING="));
  if (!line) {
    console.error("MONGO_CONNECTION_STRING is not set in .env.");
    process.exit(1);
  }
  return line.slice("MONGO_CONNECTION_STRING=".length).trim().replace(/^["']|["']$/g, "");
}

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

if (has("help")) {
  console.log(`card-impl-board — read-only view of the card implementation board

  --lane <lane>   one of: ${LANES.join(", ")}
  --set <CODE>    restrict to one set (SOR, HMW, …)
  --ids           print bare card ids only, one per line
  --out <file>    dump the raw rows as JSON

Never writes. Never prints the connection string. Run from the repo root.`);
  process.exit(0);
}

/** Card titles, so a board of ids reads as cards. */
function cardTitles() {
  const source = fs.readFileSync(GENERATED, "utf8");
  const m = /const cardTitle\s*:\s*Record<string, string>\s*=\s*\{(.*?)\n\};/s.exec(source);
  const titles = {};
  if (m) {
    for (const e of m[1].matchAll(/"([A-Za-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)"/g)) titles[e[1]] = e[2];
  }
  const sub = /const cardSubtitle\s*:\s*Record<string, string>\s*=\s*\{(.*?)\n\};/s.exec(source);
  const subs = {};
  if (sub) {
    for (const e of sub[1].matchAll(/"([A-Za-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)"/g)) subs[e[1]] = e[2];
  }
  return (id) => (subs[id] ? `${titles[id] ?? id} — ${subs[id]}` : (titles[id] ?? id));
}

const label = cardTitles();

const { default: mongoose } = await import("mongoose");
await mongoose.connect(connectionString(), { bufferCommands: false });
const coll = mongoose.connection.db.collection(COLLECTION);

try {
  const query = {};
  const lane = flag("lane");
  if (lane) {
    if (!LANES.includes(lane)) {
      console.error(`Unknown lane "${lane}". One of: ${LANES.join(", ")}`);
      process.exit(1);
    }
    query.status = lane;
  }
  let rows = await coll.find(query).toArray();

  const setCode = flag("set");
  if (setCode) rows = rows.filter((r) => String(r.cardId).split("_")[0] === setCode.toUpperCase());

  const outPath = flag("out");
  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
    console.log(`Wrote ${rows.length} rows to ${outPath}`);
  } else if (has("ids")) {
    for (const r of rows.map((r) => r.cardId).sort()) console.log(r);
  } else if (lane) {
    // Priority is a ranked lane, so show it in the order the board shows it; everything else
    // reads better alphabetically.
    const sorted = lane === "priority"
      ? rows.sort((a, b) => (a.priorityRank ?? Infinity) - (b.priorityRank ?? Infinity))
      : rows.sort((a, b) => String(a.cardId).localeCompare(String(b.cardId)));

    if (sorted.length === 0) {
      console.log(`Nothing in "${lane}"${setCode ? ` for ${setCode.toUpperCase()}` : ""}.`);
    }
    for (const r of sorted) {
      const rank = lane === "priority" && r.priorityRank != null ? `#${r.priorityRank} ` : "";
      const who = r.updatedBy ? ` (${r.updatedBy})` : "";
      console.log(`  ${rank}${String(r.cardId).padEnd(9)} ${label(r.cardId)}${who}`);
      if (r.note) console.log(`      ↳ ${r.note}`);
    }
    console.log(`\n${sorted.length} card(s) in ${lane}.`);
  } else {
    // No lane asked for: the shape of the whole board.
    const all = await coll.find({}).toArray();
    const counts = Object.fromEntries(LANES.map((l) => [l, 0]));
    for (const r of all) if (counts[r.status] !== undefined) counts[r.status] += 1;
    console.log(`${all.length} stored row(s) in ${COLLECTION}`);
    for (const l of LANES) console.log(`  ${l.padEnd(11)} ${counts[l]}`);
    console.log("\nCards with no row at all count as To Do — the board derives that lane by");
    console.log("subtraction, so it will not appear in these numbers.");
    if (all.length === 0) {
      console.log("\nCollection is empty. Seed it with: node scripts/seed-card-impl.mjs --push");
    }
  }
} finally {
  await mongoose.disconnect();
}
