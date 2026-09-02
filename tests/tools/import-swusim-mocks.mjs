#!/usr/bin/env node
/**
 * Convert card mocks from the SWUSim project's `AppCore/SWU/CardMocks.php` into this repo's
 * `card-mocks.json` schema, and print them for review.
 *
 *   node tests/tools/import-swusim-mocks.mjs <path-to-CardMocks.php> HMW_T02 HMW_T03
 *   node tests/tools/import-swusim-mocks.mjs <path> --set HMW --list
 *   node tests/tools/import-swusim-mocks.mjs <path> HMW_147 --write     # merge into card-mocks.json
 *
 * PRINTS BY DEFAULT and writes only with `--write`, because a mock entry is checked-in data that
 * drives the generated card database — it deserves a read before it lands. See ./README.md.
 *
 * The two schemas are close but not identical, and every rename below is a real one:
 *   aspect[]   -> aspects[]        trait[] -> traits[]        deployText -> leaderUnitText
 *   "Token Unit"/"Token Upgrade" -> "Unit"/"Upgrade"   (this repo stores the plain type)
 * `type2` has no SWUSim equivalent and is derived: "Unit" for an ordinary leader, "Leader" for a
 * double-sided one, empty otherwise.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TARGET = path.join(REPO_ROOT, "src/server/engine/card-db/card-mocks.json");

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? null : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

const sourcePath = argv[0];
if (!sourcePath || has("help")) {
  console.log("usage: import-swusim-mocks.mjs <CardMocks.php> [IDS...] [--set HMW] [--only-new] [--list] [--write]");
  process.exit(0);
}

/**
 * Parse the PHP `var_export` array. Only the shapes this file actually uses are handled:
 * `'key' => 'value'`, `'key' => 123`, `'key' => true|false`, and `'key' => array ( 0 => 'x', )`.
 */
function parseCardMocks(php) {
  const out = {};
  // Each entry starts at a top-level `'ID' => \n  array (` and ends at the matching `),`.
  const entryRe = /^ {2}'([A-Z0-9_]+)' =>\s*\n {2}array \(\s*\n([\s\S]*?)\n {2}\),/gm;
  let m;
  while ((m = entryRe.exec(php))) {
    const [, id, body] = m;
    const card = {};
    // Scalars. PHP escapes a single quote as \' — unescape it.
    const scalarRe = /^ {4}'(\w+)' => (?:'((?:[^'\\]|\\.)*)'|(-?\d+)|(true|false)),$/gm;
    let s;
    while ((s = scalarRe.exec(body))) {
      const [, key, str, num, bool] = s;
      if (str !== undefined) card[key] = str.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
      else if (num !== undefined) card[key] = Number(num);
      else card[key] = bool === "true";
    }
    // Arrays (aspect / trait / leaderUnitTrait). The body must be zero or more properly indented
    // item lines and nothing else — an EMPTY `array ( )` otherwise lets a lazy match run on and
    // swallow the NEXT key's items, which silently files traits under `aspect`.
    const arrRe = /^ {4}'(\w+)' =>\s*\n {4}array \(\n((?: {6}\d+ => '(?:[^'\\]|\\.)*',\n)*) {4}\),$/gm;
    let a;
    while ((a = arrRe.exec(body))) {
      const [, key, items] = a;
      card[key] = [...items.matchAll(/^ {6}\d+ => '((?:[^'\\]|\\.)*)',$/gm)]
        .map(i => i[1].replace(/\\'/g, "'"));
    }
    out[id] = card;
  }
  return out;
}

/** SWUSim shape -> this repo's MockCard shape. */
function toLocalMock(card) {
  const type = String(card.type ?? "").replace(/^Token /, ""); // "Token Unit" -> "Unit"
  const isLeader = type === "Leader";
  // A double-sided leader flips to another LEADER face; SWUSim marks that with leaderUnitType.
  const type2 = isLeader ? (card.leaderUnitType === "Leader" ? "Leader" : "Unit") : "";
  const numOrNull = (v) => (typeof v === "number" ? v : null);
  return {
    title: card.title ?? "",
    subtitle: card.subtitle ?? "",
    type,
    type2,
    arena: card.arena ?? "",
    cost: numOrNull(card.cost),
    power: numOrNull(card.power),
    hp: numOrNull(card.hp),
    upgradePower: numOrNull(card.upgradePower),
    upgradeHp: numOrNull(card.upgradeHp),
    aspects: card.aspect ?? [],
    traits: card.trait ?? [],
    text: card.text ?? "",
    epicAction: card.epicAction ?? "",
    leaderUnitText: card.deployText ?? "",
    unique: card.unique === true,
    rarity: card.rarity || "Common",
    set: card.set ?? "",
    imageUrl: card.imageUrl ?? "",
    imageUrlBack: card.imageUrlBack ?? "",
  };
}

const source = parseCardMocks(fs.readFileSync(sourcePath, "utf8"));
const setFilter = flag("set");
const ids = argv.slice(1).filter(a => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--set");

let selected = Object.keys(source);
if (setFilter) selected = selected.filter(id => source[id].set === setFilter);
if (ids.length > 0) selected = selected.filter(id => ids.includes(id));

// `--only-new` skips ids this repo already has. Use it for a bulk import: our entries have been
// corrected against the printed cards (the SWUSim copies carry "Kashirho", "Captivaling", a
// mangled Fortify reminder and an IC27 image URL on an HMW card), so a blanket overwrite would
// import those regressions on top of data our implementations and tests were built against.
if (has("only-new")) {
  const already = JSON.parse(fs.readFileSync(TARGET, "utf8"));
  selected = selected.filter(id => !already[id]);
}

if (selected.length === 0) {
  console.log("no matching entries");
  process.exit(1);
}

if (has("list")) {
  for (const id of selected) {
    const c = source[id];
    console.log(`${id.padEnd(10)} ${String(c.type).padEnd(14)} ${c.title}${c.subtitle ? ` — ${c.subtitle}` : ""}`);
  }
  console.log(`\n${selected.length} entries`);
  process.exit(0);
}

const converted = {};
for (const id of selected) converted[id] = toLocalMock(source[id]);

const existing = JSON.parse(fs.readFileSync(TARGET, "utf8"));
const collisions = selected.filter(id => existing[id]);

console.log(JSON.stringify(converted, null, 2));
console.log(`\n${selected.length} converted.`);
if (collisions.length > 0) console.log(`ALREADY IN card-mocks.json (would be overwritten): ${collisions.join(", ")}`);

if (has("write")) {
  const merged = { ...existing, ...converted };
  const sorted = {};
  for (const k of Object.keys(merged).sort((a, b) => a.localeCompare(b))) sorted[k] = merged[k];
  fs.writeFileSync(TARGET, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`\nwritten to ${path.relative(REPO_ROOT, TARGET)} — now run the card code generator.`);
}
