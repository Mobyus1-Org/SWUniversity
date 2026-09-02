import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getCardImageLink } from "@/util/func";
import { MOCK_CARD_IDS } from "@/server/engine/card-db/card-mocks";
import { CardType } from "@/server/engine/card-db/generated";

// Card art lives at /assets/cards/full/<stem>.webp, where mocked (preview) cards carry a `mock_`
// filename prefix and official cards do not.
//
// A LEADER has two arts: the front, keyed by its bare id, and the deployed unit side, keyed by
// `<id>_BACK`. The mock registry is keyed by BARE card ids, so asking it about "HMW_003_BACK"
// answers false — which quietly dropped the `mock_` prefix and left every mocked leader's unit
// side falling through the whole fallback chain to the generic card back.
//
// These tests check the generated link against the file that is actually on disk, so they fail for
// a wrong prefix rather than for a wrong-looking string.

const FULL_ART_DIR = path.join(process.cwd(), "public", "assets", "cards", "full");

const fileFor = (link: string) => path.join(FULL_ART_DIR, path.basename(link));

describe("card art links", () => {
  const mockLeaders = MOCK_CARD_IDS.filter(id => CardType(id) === "Leader");

  it("there are mocked leaders to check", () => {
    expect(mockLeaders.length).toBeGreaterThan(0);
  });

  it("a mocked leader's FRONT art link points at a real file", () => {
    for (const id of mockLeaders) {
      expect(getCardImageLink(id)).toBe(`/assets/cards/full/mock_${id}.webp`);
    }
  });

  it("a mocked leader's DEPLOYED (_BACK) art link points at a real file", () => {
    const missing: string[] = [];
    for (const id of mockLeaders) {
      const link = getCardImageLink(`${id}_BACK`);
      if (!fs.existsSync(fileFor(link))) missing.push(`${id}_BACK -> ${link}`);
    }
    expect(missing).toEqual([]);
  });

  it("keeps the mock_ prefix on the _BACK art", () => {
    const id = mockLeaders[0];
    expect(getCardImageLink(`${id}_BACK`)).toBe(`/assets/cards/full/mock_${id}_BACK.webp`);
  });

  it("leaves OFFICIAL card art unprefixed, front and back", () => {
    expect(getCardImageLink("ASH_001")).toBe("/assets/cards/full/ASH_001.webp");
    expect(getCardImageLink("ASH_001_BACK")).toBe("/assets/cards/full/ASH_001_BACK.webp");
  });

  it("does not prefix a non-mock id that merely ends in _BACK", () => {
    expect(getCardImageLink("SOR_001_BACK")).toBe("/assets/cards/full/SOR_001_BACK.webp");
  });
});
