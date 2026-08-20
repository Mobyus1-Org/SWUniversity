#!/usr/bin/env node
/**
 * Read a puzzle out of MongoDB so a bug can be reproduced against the REAL stored state.
 *
 *   node tests/tools/puzzle-fetch.mjs --list
 *   node tests/tools/puzzle-fetch.mjs "colors of leadership"
 *   node tests/tools/puzzle-fetch.mjs "colors of leadership" --out /tmp/colors.json
 *   node tests/tools/puzzle-fetch.mjs --audit roundState
 *
 * STRICTLY READ-ONLY. This connects to the live database, so it only ever issues `find` /
 * `findOne`, and it never prints the connection string. Do not add a write path here — see
 * ./README.md.
 *
 * Must be run from the repo root: it resolves `mongoose` from the repo's node_modules.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

if (has("help") || argv.length === 0) {
  console.log(`puzzle-fetch — read-only puzzle reader

  --list                 name, status and difficulty for every puzzle
  "<name>"               fetch one puzzle by case-insensitive name match
  --out <file>           write the full document as JSON (default: print summary only)
  --audit <field>        count puzzles whose initialGamestate.<field> is missing

Never writes. Never prints the connection string. Run from the repo root.`);
  process.exit(0);
}

const { default: mongoose } = await import("mongoose");
await mongoose.connect(connectionString(), { bufferCommands: false });
const puzzles = mongoose.connection.db.collection("puzzles");

try {
  if (has("list")) {
    const all = await puzzles.find({}, { projection: { name: 1, status: 1, difficulty: 1 } }).toArray();
    all.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    for (const p of all) {
      console.log(`${String(p.status ?? "?").padEnd(9)} d${p.difficulty ?? "?"}  ${p.name}`);
    }
    console.log(`\n${all.length} puzzles`);
  } else if (has("audit")) {
    const field = flag("audit");
    const all = await puzzles.find({}, { projection: { name: 1, status: 1, initialGamestate: 1 } }).toArray();
    const missing = all.filter((p) => p.initialGamestate?.[field] === undefined);
    console.log(`initialGamestate.${field} missing in ${missing.length} of ${all.length} puzzles`);
    console.log(`  deployed among them: ${missing.filter((p) => p.status === "deployed").length}`);
    for (const p of missing.slice(0, 20)) console.log(`  - ${p.name} (${p.status ?? "?"})`);
  } else {
    const name = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--out");
    const doc = await puzzles.findOne({ name: new RegExp(name, "i") });
    if (!doc) {
      console.log(`No puzzle matching ${JSON.stringify(name)}. Try --list.`);
    } else {
      const g = doc.initialGamestate ?? {};
      const side = (p = {}) => ({
        base: `${p.base?.cardId} (${p.base?.damage ?? 0} dmg)`,
        leader: `${p.leader?.cardId}${p.leader?.deployed ? " [deployed]" : ""}${p.leader?.flipped ? " [flipped]" : ""}`,
        ground: (p.groundArena ?? []).map((u) => u.cardId),
        space: (p.spaceArena ?? []).map((u) => u.cardId),
        hand: (p.hand ?? []).map((c) => c.cardId),
        deck: (p.deck ?? []).map((c) => c.cardId),
        discard: (p.discard ?? []).map((c) => c.cardId),
        resources: (p.resources ?? []).length,
      });
      console.log(`${doc.name}  |  status: ${doc.status ?? "?"}  |  difficulty: ${doc.difficulty}`);
      console.log(`activePlayer ${g.activePlayer} · phase ${g.gamePhase} · round ${g.currentRound}`);
      console.log(`roundState stored: ${g.roundState ? "yes" : "NO (hydrator defaults apply)"}`);
      console.log(`\nP1 ${JSON.stringify(side(g.player1), null, 2)}`);
      console.log(`\nP2 ${JSON.stringify(side(g.player2), null, 2)}`);
      if (doc.intendedSolution?.length) {
        console.log("\nintendedSolution:");
        doc.intendedSolution.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
      }
      const out = flag("out");
      if (out) {
        fs.writeFileSync(out, JSON.stringify(doc, null, 2));
        console.log(`\nfull document written to ${out}`);
      }
    }
  }
} finally {
  await mongoose.disconnect();
}
