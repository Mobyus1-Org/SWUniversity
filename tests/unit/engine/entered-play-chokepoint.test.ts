import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Every unit entering play — played, created, deployed, rescued, returned — must be recorded through
// RecordEnteredPlay (token-helpers.ts), which also resolves what reacts to ANY unit entering play
// (IC27_076 Clone Commander Cody). A direct push onto the entered-play ledger records the entry but
// silently skips those reactions, so this scans the engine source for one.

const ENGINE_DIR = path.join(process.cwd(), "src", "server", "engine");
const LEDGER_PUSH = /cardsEnteredPlayThisPhase\.push\(/g;

function engineFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "card-db" ? [] : engineFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("units entering play are only recorded through RecordEnteredPlay", () => {
  it("no engine code pushes onto the entered-play ledger directly", () => {
    const offenders: string[] = [];
    for (const file of engineFiles(ENGINE_DIR)) {
      if (file.endsWith("token-helpers.ts")) continue; // RecordEnteredPlay itself
      const src = fs.readFileSync(file, "utf8");
      for (const match of src.matchAll(LEDGER_PUSH)) {
        const line = src.slice(0, match.index).split("\n").length;
        offenders.push(`${path.relative(process.cwd(), file)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
