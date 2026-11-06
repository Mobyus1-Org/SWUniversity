import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Every reveal from a hand — a disclose, "reveal a card from your hand", "reveals their hand" — must
// go through RevealFromHand (core-functions.ts), or be a yes/no disclose offer carrying
// `revealsFromHand`. That is what lets SEC_016 Padmé Amidala react to it. A reveal card wired
// without either silently never triggers her, so this checks every implemented reveal card by id.

const ENGINE_DIR = path.join(process.cwd(), "src", "server", "engine");
const GENERATED = path.join(ENGINE_DIR, "card-db", "generated.ts");
// Printed text that reveals cards from a hand. "Look at" a hand is not a reveal.
const REVEALS_FROM_HAND = /disclose|reveal[^.]*from (?:your|their) hand|reveals? their hand/i;
// Cards that only REACT to reveals.
const NOT_A_REVEAL = new Set(["SEC_016"]);

function engineFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "card-db" ? [] : engineFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

/** Card ids whose printed text (either side) reveals from a hand. */
function revealCardIds(): string[] {
  const src = fs.readFileSync(GENERATED, "utf8");
  const ids = new Set<string>();
  for (const m of src.matchAll(/^\s+"([A-Z0-9]+_[A-Z0-9]+)": "(.*)",$/gm)) {
    if (REVEALS_FROM_HAND.test(m[2].replace(/\\n/g, " ")) && !NOT_A_REVEAL.has(m[1])) ids.add(m[1]);
  }
  return [...ids];
}

describe("hand reveals only go through RevealFromHand", () => {
  it("every implemented card that reveals from a hand calls it", () => {
    const sources = engineFiles(ENGINE_DIR).map(f => fs.readFileSync(f, "utf8"));
    const all = sources.join("\n");
    // Ids named on a RevealFromHand call or a revealsFromHand offer, or within the few lines above it.
    const covered = new Set<string>();
    for (const src of sources) {
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (!/RevealFromHand\(|revealsFromHand:/.test(line)) return;
        for (const near of lines.slice(Math.max(0, i - 6), i + 1)) {
          for (const id of near.matchAll(/[A-Z0-9]+_[0-9]+/g)) covered.add(id[0]);
        }
      });
    }

    const implemented = revealCardIds().filter(id => all.includes(`"${id}"`));
    expect(implemented.length).toBeGreaterThan(10); // the scan is finding them
    expect(implemented.filter(id => !covered.has(id))).toEqual([]);
  });
});
