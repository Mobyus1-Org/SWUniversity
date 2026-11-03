import { describe, it, expect } from "vitest";
import { CardText, CardType, GetAllCardIds } from "@/server/engine/card-db/generated";
import { HasFortify } from "@/server/engine/card-db/keyword-dictionaries.ts/fortify";
import { IsInScopeBoardCard } from "@/server/engine/card-db/card-scope";

// Keywords are hand-registered, never read from card text — so this pins the Fortify list to the
// printed keyword. A Fortify upgrade missing from the list silently attaches to units instead of
// the base (and misses anything keyed on Fortify, e.g. HMW_004 Tarkin's aspect-penalty waiver).
// Detected by the KEYWORD line, not the "Fortification" trait: HMW_206 The Tarkin Doctrine has
// Fortify but the trait "Law".
// Promo printings (P26_267 is a copy of HMW_126) are never playable, so only board cards count.
const printsFortify = (cardId: string) => /(^|\n)Fortify\b/.test(CardText(cardId) ?? "");

describe("Fortify registry", () => {
  const printed = GetAllCardIds()
    .filter(id => IsInScopeBoardCard(id) && CardType(id) === "Upgrade" && printsFortify(id));

  it("finds the printed Fortify upgrades", () => {
    expect(printed.length).toBeGreaterThanOrEqual(15);
  });

  it("registers every upgrade that prints Fortify", () => {
    expect(printed.filter(id => !HasFortify(id))).toEqual([]);
  });

  it("registers nothing that doesn't", () => {
    const registered = GetAllCardIds().filter(id => HasFortify(id));
    expect(registered.filter(id => !printsFortify(id))).toEqual([]);
  });
});
