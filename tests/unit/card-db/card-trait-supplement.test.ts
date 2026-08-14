import { describe, it, expect } from "vitest";
import { applyTraitSupplement, cardTraitSupplement } from "@/server/engine/card-db/card-trait-supplement";
import { CardTraits, CardType, GetAllCardIds } from "@/server/engine/card-db/generated";
import { cardOverrides } from "@/server/engine/card-db/overrides-generated";
import type { StringDictionary } from "@/server/engine/card-db/swu-api-types";

describe("applyTraitSupplement", () => {
  it("fills a card the API gave no traits for", () => {
    const traits: StringDictionary = {};
    const filled = applyTraitSupplement(traits, { ASH_019: "Peridea" });

    expect(traits.ASH_019).toBe("Peridea");
    expect(filled).toBe(1);
  });

  // Official data ALWAYS wins, so the file goes inert on its own if the API ever starts
  // publishing base traits rather than masking whatever it publishes.
  it("never overwrites traits the API did supply", () => {
    const traits: StringDictionary = { ASH_019: "Something Official" };
    const filled = applyTraitSupplement(traits, { ASH_019: "Peridea" });

    expect(traits.ASH_019).toBe("Something Official");
    expect(filled).toBe(0);
  });

  it("treats a blank official value as a gap", () => {
    const traits: StringDictionary = { ASH_019: "   " };
    applyTraitSupplement(traits, { ASH_019: "Peridea" });

    expect(traits.ASH_019).toBe("Peridea");
  });

  it("normalizes to the comma-joined, space-free form the generator stores", () => {
    const traits: StringDictionary = {};
    applyTraitSupplement(traits, { ASH_019: " Peridea , Dathomir " });

    expect(traits.ASH_019).toBe("Peridea,Dathomir");
  });

  it("skips an entry whose value is empty", () => {
    const traits: StringDictionary = {};
    const filled = applyTraitSupplement(traits, { ASH_019: "" });

    expect(traits.ASH_019).toBeUndefined();
    expect(filled).toBe(0);
  });

  it("leaves unrelated cards alone", () => {
    const traits: StringDictionary = { SOR_001: "Rebel" };
    applyTraitSupplement(traits, { ASH_019: "Peridea" });

    expect(Object.keys(traits).sort()).toEqual(["ASH_019", "SOR_001"]);
  });
});

describe("the tracked supplement", () => {
  it("supplies a non-empty trait for every entry", () => {
    for (const [cardId, traits] of Object.entries(cardTraitSupplement)) {
      expect(traits.trim(), `${cardId} has an empty supplement value`).not.toBe("");
    }
  });

  it("only lists real card ids", () => {
    for (const cardId of Object.keys(cardTraitSupplement)) {
      expect(CardType(cardId), `${cardId} is not a known card`).not.toBe("");
    }
  });

  // Every base prints a location trait, and must get one from exactly one of three places:
  // official data, its own supplement entry, or — for a promo reprint — the override that copies
  // its original's rows across. This holds both before the next generator run (the trait lives
  // only in the supplement) and after it (the generator has written it into generated.ts), so it
  // does not go stale at regeneration.
  it("leaves no base without a trait from one source or another", () => {
    const bases = GetAllCardIds().filter((cardId) => CardType(cardId) === "Base");
    expect(bases.length).toBeGreaterThan(0);

    const covered = (cardId: string): boolean =>
      CardTraits(cardId).length > 0 || cardId in cardTraitSupplement;

    const missing = bases.filter((cardId) => {
      if (covered(cardId)) return false;
      const original = (cardOverrides as Record<string, string>)[cardId];
      return !original || !covered(original);
    });

    expect(missing).toEqual([]);
  });
});
