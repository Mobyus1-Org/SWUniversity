// seed-card-impl.mjs [--out <file>] [--push] [--limit N]
//
// One-time seed for the /admin/cards-impl board: marks every card that is ALREADY implemented as
// "done". Cards still to do are deliberately NOT written — the board treats "no row" as To Do, so
// seeding them would add ~940 rows that mean nothing.
//
//   node scripts/seed-card-impl.mjs                     # dry run: summary only, touches nothing
//   node scripts/seed-card-impl.mjs --out /tmp/seed.json  # JSON for mongoimport / Atlas import
//   node scripts/seed-card-impl.mjs --push              # upsert straight into Mongo
//
// HOW "IMPLEMENTED" IS DERIVED — the same rule cards-remaining.md documents:
//
//   done = the card prints no mechanical ability at all (a vanilla body needs no engine code)
//          OR its id appears somewhere in src/ or pages/ that is not generated data
//   todo = everything else
//
// Generated data files are excluded because they name every card regardless of implementation:
// generated.ts (the card database), card-mocks.json, card-trait-supplement.json, and — the easy
// one to miss — overrides-generated.ts, which is a promo→base-set alias table. Counting that one
// wrongly marks ~300 cards done.
//
// Validated against cards-remaining.md: SOR 2/2, TWI 99/99, IBH 19/19 exact, every other set
// within a handful. The remaining differences are real: cards implemented since that file was
// written, HMW (which postdates it), and ~25 keyword-only SEC/LOF/JTL cards it omitted but which
// genuinely have no keyword registration.
//
// SAFE TO RE-RUN. Writes use $setOnInsert, so a card someone has already moved to Priority or
// Needs Work is never overwritten.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED = path.join(REPO_ROOT, "src/server/engine/card-db/generated.ts");

/** Mongoose lower-cases and pluralises the model name; this must match CardImplStatusModel. */
const COLLECTION = "cardimplstatuses";

const CATALOG_SETS = new Set([
  "SOR", "SHD", "TWI", "JTL", "LOF", "SEC", "IBH", "LAW", "TS26", "ASH", "HMW",
]);

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

// ---------------------------------------------------------------------------
// Card data
// ---------------------------------------------------------------------------

function readDictionary(source, name) {
  const m = new RegExp(`const ${name}\\s*:\\s*Record<string, string>\\s*=\\s*\\{(.*?)\\n\\};`, "s").exec(source);
  if (!m) throw new Error(`Could not find ${name} in generated.ts`);
  const out = {};
  for (const entry of m[1].matchAll(/"([A-Za-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)"/g)) {
    out[entry[1]] = entry[2];
  }
  return out;
}

/** Does the card print any ability, once reminder text in parentheses is stripped? */
function hasMechanicalText(text) {
  return (text ?? "")
    .replace(/\\n/g, "\n")
    .split("\n")
    .some((line) => line.replace(/\([^)]*\)/g, "").trim().length > 0);
}

/** Generated data names every card, so it is never evidence that one is implemented. */
function isGeneratedData(fileName) {
  return fileName.endsWith("generated.ts")
    || fileName === "card-mocks.json"
    || fileName === "card-trait-supplement.json";
}

function collectReferencedIds() {
  const referenced = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (isGeneratedData(entry.name)) continue;
      if (!/\.(ts|tsx|json)$/.test(entry.name)) continue;
      const body = fs.readFileSync(full, "utf8");
      for (const m of body.matchAll(/\b([A-Z]{2,4}[0-9]{0,2}_[0-9]{2,3})\b/g)) referenced.add(m[1]);
    }
  };
  for (const root of ["src", "pages"]) walk(path.join(REPO_ROOT, root));
  return referenced;
}

function derive() {
  const source = fs.readFileSync(GENERATED, "utf8");
  const titles = readDictionary(source, "cardTitle");
  const texts = readDictionary(source, "cardText");
  const referenced = collectReferencedIds();

  const inScope = Object.keys(titles)
    .filter((id) => !id.includes("_T") && CATALOG_SETS.has(id.split("_")[0]))
    .sort();

  const done = [];
  const todo = [];
  for (const id of inScope) {
    const vanilla = !hasMechanicalText(texts[id]);
    (vanilla || referenced.has(id) ? done : todo).push(id);
  }
  return { inScope, done, todo, titles };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function summarise({ inScope, done, todo }) {
  const bySet = {};
  for (const id of todo) {
    const set = id.split("_")[0];
    bySet[set] = (bySet[set] ?? 0) + 1;
  }
  console.log(`${inScope.length} cards in scope`);
  console.log(`  done  ${done.length}   <- these get seeded`);
  console.log(`  todo  ${todo.length}   <- no row written; the board reads absence as To Do`);
  console.log("");
  console.log("remaining by set:");
  for (const [set, n] of Object.entries(bySet).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${set.padEnd(5)} ${n}`);
  }
}

function documents(done) {
  const now = new Date();
  return done.map((cardId) => ({
    cardId,
    status: "done",
    note: "",
    updatedBy: "seed",
    createdAt: now,
    updatedAt: now,
  }));
}

async function push(done) {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    console.error("No .env at the repo root — cannot reach the database.");
    process.exit(1);
  }
  // Read the URI without ever echoing it — same rule as tests/tools/puzzle-fetch.mjs.
  const line = fs.readFileSync(envPath, "utf8").split("\n")
    .find((l) => l.startsWith("MONGO_CONNECTION_STRING="));
  if (!line) {
    console.error("MONGO_CONNECTION_STRING is not set in .env.");
    process.exit(1);
  }
  const uri = line.slice("MONGO_CONNECTION_STRING=".length).trim().replace(/^["']|["']$/g, "");

  const { default: mongoose } = await import("mongoose");
  await mongoose.connect(uri);
  const coll = mongoose.connection.collection(COLLECTION);

  // $setOnInsert: a card somebody has already moved to Priority or Needs Work keeps its row.
  const ops = documents(done).map((doc) => ({
    updateOne: { filter: { cardId: doc.cardId }, update: { $setOnInsert: doc }, upsert: true },
  }));

  let inserted = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const result = await coll.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    inserted += result.upsertedCount ?? 0;
    process.stdout.write(`\r  ${Math.min(i + 500, ops.length)}/${ops.length}`);
  }
  console.log(`\n  inserted ${inserted}, left ${ops.length - inserted} existing row(s) untouched.`);
  await mongoose.disconnect();
}

// ---------------------------------------------------------------------------

const result = derive();
summarise(result);

const limit = flag("limit") ? Number(flag("limit")) : null;
const done = limit ? result.done.slice(0, limit) : result.done;

const outPath = flag("out");
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(documents(done), null, 2));
  console.log(`\nWrote ${done.length} documents to ${outPath}`);
  console.log(`Import with:\n  mongoimport --uri "<your Atlas URI>" --collection ${COLLECTION} --jsonArray --file ${outPath}`);
} else if (has("push")) {
  console.log(`\nPushing ${done.length} documents to ${COLLECTION}…`);
  await push(done);
} else {
  console.log("\nDry run — nothing written. Use --out <file> for JSON, or --push to write to Mongo.");
}
