#!/usr/bin/env node
/**
 * Look up cards in the generated card database, or search it for a test fixture.
 *
 *   node tests/tools/card-info.mjs SEC_232
 *   node tests/tools/card-info.mjs kreia
 *   node tests/tools/card-info.mjs --set TWI --type Unit --trait Republic --no-text
 *   node tests/tools/card-info.mjs --grep "shares an aspect"
 *
 * See ./README.md. Run from the repo root.
 */

import { loadCards, findById, formatCard } from "./card-db.mjs";

const argv = process.argv.slice(2);

function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
}
const has = (name) => argv.includes(`--${name}`);

if (argv.length === 0 || has("help")) {
  console.log(`card-info — query src/server/engine/card-db/generated.ts

  <SET_NNN>              full detail for one card id
  <text>                 search titles and subtitles (case-insensitive substring)

Filters (combine freely; prints a compact list):
  --set TWI              card set
  --type Unit            Unit | Event | Upgrade | Leader | Base
  --trait Republic       has this trait
  --aspect Heroism       has this aspect
  --arena Ground         Ground | Space
  --cost 2               exact cost
  --max-cost 3           cost <= N
  --grep "<pattern>"     case-insensitive regex over card text
  --no-text              only cards with NO card text (clean test fixtures)
  --has-text             only cards WITH card text
  --unique / --not-unique
  --limit 40             cap results (default 40)
  --ids                  print bare ids only`);
  process.exit(0);
}

const positional = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const cards = loadCards();

// Exact id lookup — the common case, so it short-circuits everything else.
const direct = positional[0] ? findById(positional[0]) : null;
if (direct) {
  console.log(formatCard(direct, { full: true }));
  process.exit(0);
}

let results = cards;
const q = positional[0]?.toLowerCase();
if (q) {
  results = results.filter((c) =>
    c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
}

const set = flag("set");
const type = flag("type");
const trait = flag("trait");
const aspect = flag("aspect");
const arena = flag("arena");
const cost = flag("cost");
const maxCost = flag("max-cost");
const grep = flag("grep");

if (set) results = results.filter((c) => c.set.toUpperCase() === set.toUpperCase());
if (type) results = results.filter((c) => c.type.toLowerCase() === type.toLowerCase());
if (trait) results = results.filter((c) => c.traits.some((t) => t.toLowerCase() === trait.toLowerCase()));
if (aspect) results = results.filter((c) => c.aspects.some((a) => a.toLowerCase() === aspect.toLowerCase()));
if (arena) results = results.filter((c) => c.arena.toLowerCase() === arena.toLowerCase());
if (cost !== null) results = results.filter((c) => c.cost === Number(cost));
if (maxCost !== null) results = results.filter((c) => typeof c.cost === "number" && c.cost <= Number(maxCost));
if (grep) {
  const re = new RegExp(grep, "i");
  results = results.filter((c) => re.test(c.text) || re.test(c.leaderUnitText));
}
if (has("no-text")) results = results.filter((c) => !c.text);
if (has("has-text")) results = results.filter((c) => c.text);
if (has("unique")) results = results.filter((c) => c.unique);
if (has("not-unique")) results = results.filter((c) => !c.unique);

// Promo/token reprints duplicate a base-set card and are almost never what you want in a fixture.
if (!has("include-reprints")) {
  results = results.filter((c) => !/^(P\d|[A-Z]+P_)/.test(c.id) && !/_T\d/.test(c.id));
}

const limit = Number(flag("limit") ?? 40);
const shown = results.slice(0, limit);

if (shown.length === 0) {
  console.log("no matches");
  process.exit(0);
}

if (has("ids")) {
  console.log(shown.map((c) => c.id).join(" "));
} else if (shown.length === 1) {
  console.log(formatCard(shown[0], { full: true }));
} else {
  for (const c of shown) console.log(formatCard(c));
  console.log();
}
console.log(`${results.length} match${results.length === 1 ? "" : "es"}${results.length > shown.length ? ` (showing ${shown.length}; --limit to raise)` : ""}`);
