import { describe, it, expect } from "vitest";
import { InScopeBoardCardIds, IsInScopeBoardCard } from "@/server/engine/card-db/card-scope";

// The board's card universe. Literal ids are used deliberately here: this test is ABOUT id
// filtering, so routing through the Cards helper would hide the very strings under test.
describe("in-scope board cards", () => {
  it("totals 2405 cards", () => {
    expect(InScopeBoardCardIds()).toHaveLength(2405);
  });

  it("includes official cards", () => {
    expect(IsInScopeBoardCard("SOR_095")).toBe(true);
  });

  it("includes preview (mock) cards", () => {
    expect(IsInScopeBoardCard("HMW_035")).toBe(true);
  });

  it("excludes token printings", () => {
    expect(IsInScopeBoardCard("HMW_T03")).toBe(false);
    expect(IsInScopeBoardCard("SOR_T02")).toBe(false);
  });

  it("excludes promo printings, which carry a base-set cardSet but a promo id prefix", () => {
    // ASHP_003 has cardSet "ASH"; filtering on the SET FIELD would wrongly keep it.
    expect(IsInScopeBoardCard("ASHP_003")).toBe(false);
    expect(IsInScopeBoardCard("P25_100")).toBe(false);
  });

  it("is sorted and free of duplicates", () => {
    const ids = InScopeBoardCardIds();
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
