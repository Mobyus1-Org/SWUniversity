import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Every heal from a base must go through HealBaseForPlayer (core-functions.ts). It applies TWI_132
// Confederate Tri-Fighter's "Bases can't be healed", caps the heal at the base's damage, and fires
// "When you heal damage from your base" reactions (IC27_026 Darth Sidious). A base whose damage is
// lowered directly skips all three, so this scans the engine source for any such write.

const ENGINE_DIR = path.join(process.cwd(), "src", "server", "engine");
// `<something>base<something>.damage -= …` or `… .damage = Math.max(0, … .damage - …)` on a base.
const DIRECT_BASE_HEAL = /[bB]ase\w*\.damage\s*(?:-=|=\s*Math\.max\(\s*0\s*,)/g;

function engineFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "card-db" ? [] : engineFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("base heals only go through HealBaseForPlayer", () => {
  it("no engine code lowers a base's damage directly", () => {
    const offenders: string[] = [];
    for (const file of engineFiles(ENGINE_DIR)) {
      const src = fs.readFileSync(file, "utf8");
      for (const match of src.matchAll(DIRECT_BASE_HEAL)) {
        const before = src.slice(0, match.index);
        // HealBaseForPlayer's own write is the one allowed site.
        const fn = before.lastIndexOf("export function ");
        if (before.slice(fn, fn + 40).startsWith("export function HealBaseForPlayer")) continue;
        offenders.push(`${path.relative(process.cwd(), file)}:${before.split("\n").length}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
