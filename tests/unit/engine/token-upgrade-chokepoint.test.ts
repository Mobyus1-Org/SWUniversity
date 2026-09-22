import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Every token upgrade put onto a unit must go through GiveTokenUpgrade (token-helpers.ts), which is
// what records WHO gave it this phase (HMW_005 Jar Jar Binks: "If you gave a token upgrade to a unit
// this phase"). A token pushed straight onto `upgrades` silently skips that record, so this scans
// the engine source for any such push.
//
// Moving an EXISTING token between units (moveUpgradeToUnit) pushes a variable, not a literal, and is
// correctly not a gift — so only pushes that CREATE a token are flagged.

const ENGINE_DIR = path.join(process.cwd(), "src", "server", "engine");
const TOKEN_UPGRADE_PUSH =
  /\.upgrades\.push\(\s*\{\s*cardId:\s*(?:"(?:SOR_T01|SOR_T02|ASH_T02|HMW_T02)"|[A-Z_]*TOKEN\b)/g;

function engineFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "card-db" ? [] : engineFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("token upgrades are only given through GiveTokenUpgrade", () => {
  it("no engine code pushes a token upgrade onto a unit directly", () => {
    const offenders: string[] = [];
    for (const file of engineFiles(ENGINE_DIR)) {
      if (file.endsWith("token-helpers.ts")) continue; // GiveTokenUpgrade itself
      const src = fs.readFileSync(file, "utf8");
      for (const match of src.matchAll(TOKEN_UPGRADE_PUSH)) {
        const line = src.slice(0, match.index).split("\n").length;
        offenders.push(`${path.relative(process.cwd(), file)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
