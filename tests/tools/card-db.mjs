/**
 * Shared reader for the generated card database.
 *
 * `src/server/engine/card-db/generated.ts` is a set of parallel `Record<string, T>` literals, one
 * per property. It is far too large to read into an agent's context, and it cannot be imported
 * from plain node (it is TypeScript with `@/` path aliases), so these helpers parse the literals
 * out of the source text instead.
 *
 * Not a test file and never imported by the engine — see ./README.md.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED = path.join(REPO_ROOT, "src/server/engine/card-db/generated.ts");

/** Slice out `const <name>: Record<...> = { ... };` by brace-free scan to the first `};`. */
function dictionaryBody(source, name) {
  const start = source.indexOf(`const ${name}:`);
  if (start === -1) throw new Error(`dictionary not found in generated.ts: ${name}`);
  const end = source.indexOf("};", start);
  return source.slice(start, end);
}

/** `"ID": "value"` — the value regex tolerates escaped quotes inside card text. */
function parseStrings(body) {
  const out = {};
  const re = /"([A-Z0-9_]+)": "((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  return out;
}

function parseNumbers(body) {
  const out = {};
  const re = /"([A-Z0-9_]+)": (-?\d+)/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = Number(m[2]);
  return out;
}

function parseBooleans(body) {
  const out = {};
  const re = /"([A-Z0-9_]+)": (true|false)/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2] === "true";
  return out;
}

let cache = null;

/**
 * Every card as a single keyed object — the shape the parallel dictionaries would have had if the
 * generator emitted one record per card. Reading a stat off the wrong dictionary is a known
 * footgun (cost/power/hp are three separate maps), so everything is joined here once.
 */
export function loadCards() {
  if (cache) return cache;
  const src = fs.readFileSync(GENERATED, "utf8");

  const str = (n) => parseStrings(dictionaryBody(src, n));
  const num = (n) => parseNumbers(dictionaryBody(src, n));
  const bool = (n) => parseBooleans(dictionaryBody(src, n));

  const title = str("cardTitle");
  const subtitle = str("cardSubtitle");
  const text = str("cardText");
  const leaderUnitText = str("cardLeaderUnitText");
  const type = str("cardType");
  const type2 = str("cardType2");
  const set = str("cardSet");
  const rarity = str("cardRarity");
  const aspects = str("cardAspects");
  const traits = str("cardTraits");
  const arena = str("cardArena");
  const cost = num("cardCost");
  const power = num("cardPower");
  const hp = num("cardHp");
  const upgradePower = num("cardUpgradePower");
  const upgradeHp = num("cardUpgradeHp");
  const unique = bool("cardIsUnique");

  cache = Object.keys(title).map((id) => ({
    id,
    title: title[id] ?? "",
    subtitle: subtitle[id] ?? "",
    type: type[id] ?? "",
    type2: type2[id] ?? "",
    set: set[id] ?? "",
    rarity: rarity[id] ?? "",
    cost: cost[id],
    power: power[id],
    hp: hp[id],
    upgradePower: upgradePower[id],
    upgradeHp: upgradeHp[id],
    arena: arena[id] ?? "",
    unique: unique[id] === true,
    aspects: (aspects[id] ?? "").split(",").filter(Boolean),
    traits: (traits[id] ?? "").split(",").filter(Boolean),
    text: text[id] ?? "",
    leaderUnitText: leaderUnitText[id] ?? "",
  }));
  return cache;
}

export function findById(id) {
  return loadCards().find((c) => c.id === id.toUpperCase()) ?? null;
}

export function formatCard(c, { full = false } = {}) {
  const stats = c.type === "Upgrade"
    ? `+${c.upgradePower ?? 0}/+${c.upgradeHp ?? 0}`
    : `${c.power ?? "-"}/${c.hp ?? "-"}`;
  const head = `${c.id}  ${c.title}${c.subtitle ? ` — ${c.subtitle}` : ""}`;
  const line2 = `  ${c.set} ${c.type}${c.type2 && c.type2 !== c.type ? `/${c.type2}` : ""}`
    + ` | cost ${c.cost ?? "-"} | ${stats}${c.arena ? ` ${c.arena}` : ""}`
    + `${c.unique ? " | unique" : ""}`;
  const line3 = `  aspects: ${c.aspects.join(", ") || "-"} | traits: ${c.traits.join(", ") || "-"}`;
  if (!full) return `${head}\n${line2}\n${line3}`;
  const body = c.text ? `\n  TEXT:\n${c.text.split("\n").map((l) => `    ${l}`).join("\n")}` : "\n  TEXT: (none)";
  const deployed = c.leaderUnitText
    ? `\n  DEPLOYED (cardLeaderUnitText):\n${c.leaderUnitText.split("\n").map((l) => `    ${l}`).join("\n")}`
    : "";
  return `${head}\n${line2}\n${line3}${body}${deployed}`;
}
