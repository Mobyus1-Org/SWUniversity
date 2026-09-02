import { describe, it, expect } from "vitest";
import { GetAllCardIds, CardTitle, CardType } from "@/server/engine/card-db/generated";
import { CATALOG_SETS, EXCLUDED_SETS, TOKEN_UNIT_IDS, TOKEN_UPGRADE_IDS } from "../../../pages/api/internal/card-catalog";

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

// The builder's token pickers are hand-maintained lists, SEPARATE from the set allowlist above —
// a token missing from them is unplaceable in the editor even though its set is included. That is
// the same silent-omission shape, one level down.
describe("puzzle editor card catalog — token coverage", () => {
  /** Distinct token NAMES that exist in the card database, by type. */
  function tokenTitlesByType(type: "Unit" | "Upgrade"): Set<string> {
    const titles = new Set<string>();
    for (const cardId of GetAllCardIds()) {
      if (!/_T\d/.test(cardId)) continue;
      if (CardType(cardId) !== type) continue;
      titles.add(CardTitle(cardId));
    }
    return titles;
  }

  const offeredTitles = (ids: readonly string[]) => new Set(ids.map(id => CardTitle(id)));

  it("offers every distinct token UNIT", () => {
    const missing = [...tokenTitlesByType("Unit")].filter(t => !offeredTitles(TOKEN_UNIT_IDS).has(t));
    expect(missing, `Token units in the card database but not in TOKEN_UNIT_IDS:\n  ${missing.join(", ")}\n`).toEqual([]);
  });

  it("offers every distinct token UPGRADE", () => {
    const missing = [...tokenTitlesByType("Upgrade")].filter(t => !offeredTitles(TOKEN_UPGRADE_IDS).has(t));
    expect(missing, `Token upgrades in the card database but not in TOKEN_UPGRADE_IDS:\n  ${missing.join(", ")}\n`).toEqual([]);
  });

  it("lists one printing per token, not one per set", () => {
    // Experience and Shield are reprinted in most sets; the picker wants the canonical copy only.
    for (const ids of [TOKEN_UNIT_IDS, TOKEN_UPGRADE_IDS]) {
      const titles = ids.map(id => CardTitle(id));
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});
