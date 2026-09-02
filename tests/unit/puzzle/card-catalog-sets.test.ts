import { describe, it, expect } from "vitest";
import { GetAllCardIds } from "@/server/engine/card-db/generated";
import { CATALOG_SETS, EXCLUDED_SETS } from "../../../pages/api/internal/card-catalog";

// The puzzle editor's card picker is fed by /api/internal/card-catalog, which filters cards
// through a HAND-MAINTAINED set allowlist. A set missing from that list is silently invisible in
// the editor — no error, no empty state, the cards simply are not offered.
//
// That is exactly how the HMW preview cards went missing: 31 mocked cards generated correctly,
// were playable by the engine, and could not be placed on a puzzle because "HMW" was not in the
// allowlist. This test makes the next set fail loudly instead.

/** Every set code that actually has cards in the generated database. */
function setsInCardDb(): string[] {
  const sets = new Set<string>();
  for (const cardId of GetAllCardIds()) sets.add(cardId.split("_")[0]);
  return [...sets].sort();
}

describe("puzzle editor card catalog — set coverage", () => {
  it("every set in the card database is explicitly included or excluded", () => {
    const unclassified = setsInCardDb()
      .filter(set => !CATALOG_SETS.has(set) && !EXCLUDED_SETS.has(set));

    expect(
      unclassified,
      `These sets exist in the card database but are in neither CATALOG_SETS nor EXCLUDED_SETS in\n`
      + `pages/api/internal/card-catalog.ts, so their cards are silently missing from the puzzle\n`
      + `editor. Add each to one list or the other:\n  ${unclassified.join(", ")}\n`,
    ).toEqual([]);
  });

  it("includes HMW, the preview set", () => {
    // Regression: QA could not place any HMW preview card in the puzzle editor.
    expect(CATALOG_SETS.has("HMW")).toBe(true);
  });

  it("the two lists never overlap", () => {
    const both = [...CATALOG_SETS].filter(set => EXCLUDED_SETS.has(set));
    expect(both).toEqual([]);
  });
});
