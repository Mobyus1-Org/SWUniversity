// backfill-base-traits.js [--dry] [--type=Base] [--set=HMW]
//
// Fills src/server/engine/card-db/card-trait-supplement.json with the traits the official SWU API
// omits. That API returns NO traits for bases — all 99 come back empty — though every base prints
// a location trait. swudb publishes them, so we read them from there once and keep the result as
// tracked source; nothing queries swudb at runtime or during an ordinary regen.
//
// Walks every card of the target type whose trait list is EMPTY in the generated dictionaries and
// looks each one up. ADDITIVE + IDEMPOTENT: existing entries are kept unless the fetch returns
// something different, and cards that already have official traits are skipped entirely.
//
//   npm run backfill-base-traits -- --dry
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_PATH = path.join(__dirname, "../src/server/engine/card-db/generated.ts");
const SUPPLEMENT_PATH = path.join(__dirname, "../src/server/engine/card-db/card-trait-supplement.json");

const SWU_PREVIEW_API = "https://swudb.com/api/card";
// Kept in step with TWO_DIGIT_CARD_NUMBER_SETS in generator.ts.
const TWO_DIGIT_SETS = new Set(["TS26"]);

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const targetType = (args.find((a) => a.startsWith("--type=")) ?? "--type=Base").split("=")[1];
const targetSet = (args.find((a) => a.startsWith("--set=")) ?? "--set=").split("=")[1].toUpperCase();

/**
 * generated.ts is machine-written with a fixed layout, so the two dictionaries this needs are read
 * straight out of it rather than importing TypeScript from a plain node script.
 */
function readDictionary(source, name) {
  const block = new RegExp(`const ${name}: Record<string, \\w+> = \\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (!block) throw new Error(`could not find dictionary "${name}" in generated.ts`);

  const entries = {};
  for (const line of block[1].split("\n")) {
    const match = /^\s*"([^"]+)": "((?:[^"\\]|\\.)*)",\s*$/.exec(line);
    if (match) entries[match[1]] = match[2];
  }
  return entries;
}

function padCardNumber(setCode, cardNumber) {
  const width = TWO_DIGIT_SETS.has(setCode.toUpperCase()) ? 2 : 3;
  const stripped = cardNumber.replace(/^0+/, "") || "0";
  return stripped.padStart(width, "0");
}

async function fetchTraits(cardId) {
  const underscore = cardId.indexOf("_");
  const set = cardId.slice(0, underscore);
  const number = cardId.slice(underscore + 1);

  const response = await fetch(`${SWU_PREVIEW_API}/getPrintingInfo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expansionAbbreviation: set,
      cardNumber: padCardNumber(set, number),
      isFoil: false,
      language: "en",
      stamp: null,
    }),
  });
  if (!response.ok) return null;

  const record = await response.json();
  if (!record || typeof record.cardName !== "string" || record.cardName === "") return null;

  // The source is inconsistent: elements can carry leading spaces and occasionally arrive
  // comma-joined in one string.
  const traits = [];
  for (const entry of Array.isArray(record.traits) ? record.traits : []) {
    for (const piece of String(entry).split(",")) {
      const trimmed = piece.trim();
      if (trimmed !== "" && !traits.includes(trimmed)) traits.push(trimmed);
    }
  }
  return { traits: traits.join(","), cardName: record.cardName };
}

const source = fs.readFileSync(GENERATED_PATH, "utf8");
const cardType = readDictionary(source, "cardType");
const cardTraits = readDictionary(source, "cardTraits");

const existing = fs.existsSync(SUPPLEMENT_PATH)
  ? JSON.parse(fs.readFileSync(SUPPLEMENT_PATH, "utf8"))
  : {};

const candidates = Object.keys(cardType)
  .filter((cardId) => cardType[cardId] === targetType)
  .filter((cardId) => targetSet === "" || cardId.split("_")[0].toUpperCase() === targetSet)
  .filter((cardId) => (cardTraits[cardId] ?? "").trim() === "") // official data present -> skip
  .sort();

console.log(`${candidates.length} ${targetType} card(s) with no official traits`);

const result = { ...existing };
let added = 0;
let changed = 0;
let unresolved = [];

for (const cardId of candidates) {
  const fetched = await fetchTraits(cardId);
  if (!fetched || fetched.traits === "") {
    unresolved.push(cardId);
    console.log(`  ?  ${cardId} — no traits from source`);
    continue;
  }

  const previous = result[cardId];
  if (previous === fetched.traits) continue;

  result[cardId] = fetched.traits;
  if (previous === undefined) {
    added += 1;
    console.log(`  +  ${cardId}  ${fetched.traits}  (${fetched.cardName})`);
  } else {
    changed += 1;
    console.log(`  ~  ${cardId}  ${previous} -> ${fetched.traits}  (${fetched.cardName})`);
  }
}

const sorted = {};
for (const cardId of Object.keys(result).sort()) sorted[cardId] = result[cardId];

console.log(
  `\n${added} added, ${changed} changed, ${Object.keys(result).length} total, ${unresolved.length} unresolved`,
);
if (unresolved.length > 0) console.log(`unresolved: ${unresolved.join(", ")}`);

if (dry) {
  console.log("dry run — nothing written");
} else {
  fs.writeFileSync(SUPPLEMENT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  console.log(`wrote ${path.relative(process.cwd(), SUPPLEMENT_PATH)}`);
}
