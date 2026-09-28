import { describe, it, expect } from "vitest";
import path from "node:path";
import { access, rm } from "node:fs/promises";
import { generateCardImagesFromResolvedCardsAsync } from "@/server/engine/card-db/generator";
import { mockToSwuAttributes } from "@/server/engine/card-db/mock-adapter";
import { cardMocks } from "@/server/engine/card-db/card-mocks";
import type { SwuCardAttributes } from "@/server/engine/card-db/swu-api-types";

// TEMPORARY: really downloads a mock's art to verify the mock_ naming branch in the image loop.
// Deleted after running — it writes into public/assets and makes live HTTP calls.
const FULL = path.join(process.cwd(), "public/assets/cards/full");
const SQUARE = path.join(process.cwd(), "public/assets/cards/square");

async function exists(p: string) {
  try { await access(p); return true; } catch { return false; }
}

describe("mock art naming, end to end", () => {
  it("writes mock_ files and never a bare official name", async () => {
    const mock = cardMocks.ASH_004;
    expect(mock).toBeDefined();

    const resolved = new Map<string, SwuCardAttributes>([
      ["ASH_004", mockToSwuAttributes("ASH_004", mock)],
    ]);

    const summary = await generateCardImagesFromResolvedCardsAsync(resolved, 0);
    console.log("SUMMARY", JSON.stringify(summary, null, 2));

    expect(await exists(path.join(FULL, "mock_ASH_004.webp"))).toBe(true);
    expect(await exists(path.join(SQUARE, "mock_ASH_004.webp"))).toBe(true);
    expect(await exists(path.join(FULL, "mock_ASH_004_BACK.webp"))).toBe(true);
    expect(await exists(path.join(SQUARE, "mock_ASH_004_BACK.webp"))).toBe(true);

    // A second run must skip, not re-download.
    const second = await generateCardImagesFromResolvedCardsAsync(resolved, 0);
    expect(second.skipped).toBe(1);
    expect(second.generatedFull).toBe(0);

    for (const dir of [FULL, SQUARE]) {
      for (const name of ["mock_ASH_004.webp", "mock_ASH_004_BACK.webp"]) {
        await rm(path.join(dir, name), { force: true });
      }
    }
  }, 60000);
});
