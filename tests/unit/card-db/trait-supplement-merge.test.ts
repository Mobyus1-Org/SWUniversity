import { describe, it, expect } from "vitest";
import { buildDictionaries } from "@/server/engine/card-db/generator";
import { mockToSwuAttributes } from "@/server/engine/card-db/mock-adapter";
import type { MockCard } from "@/server/engine/card-db/card-mocks";
import type { SwuCardAttributes } from "@/server/engine/card-db/swu-api-types";

function base(overrides: Partial<MockCard> = {}): MockCard {
  return {
    title: "Test Base",
    subtitle: "",
    type: "Base",
    type2: "",
    arena: "",
    cost: null,
    power: null,
    hp: 30,
    upgradePower: null,
    upgradeHp: null,
    aspects: ["Command"],
    traits: [],
    text: "",
    epicAction: "",
    leaderUnitText: "",
    unique: false,
    rarity: "Common",
    set: "HMW",
    imageUrl: "",
    imageUrlBack: "",
    ...overrides,
  };
}

function resolved(entries: Array<[string, MockCard]>): Map<string, SwuCardAttributes> {
  return new Map(entries.map(([cardId, card]) => [cardId, mockToSwuAttributes(cardId, card)]));
}

describe("trait supplement inside the generator", () => {
  it("fills a base the API published no traits for", () => {
    const dictionaries = buildDictionaries(
      resolved([["HMW_019", base()]]),
      {},
      { HMW_019: "Peridea" },
    );

    expect(dictionaries.cardTraits.HMW_019).toBe("Peridea");
  });

  it("does not touch a card the API did publish traits for", () => {
    const dictionaries = buildDictionaries(
      resolved([["HMW_019", base({ traits: ["Official Value"] })]]),
      {},
      { HMW_019: "Peridea" },
    );

    expect(dictionaries.cardTraits.HMW_019).toBe("Official Value");
  });

  // A mocked base carries the traits swudb published, so the supplement leaves it alone. After
  // release the official row has none and the supplement fills the same value back in — which is
  // the whole point: the card's traits do not change at cutover.
  it("gives a mocked base and its released form the same traits", () => {
    const mocked = buildDictionaries(
      resolved([["HMW_019", base({ traits: ["Peridea"] })]]),
      {},
      { HMW_019: "Peridea" },
    );
    const released = buildDictionaries(
      resolved([["HMW_019", base({ traits: [] })]]),
      {},
      { HMW_019: "Peridea" },
    );

    expect(mocked.cardTraits.HMW_019).toBe(released.cardTraits.HMW_019);
  });

  // The supplement must run BEFORE promo overrides copy an original card's rows onto its promo
  // id, or the promo reprint of a base ends up with no traits: the supplement is keyed by the
  // ORIGINAL id and would never see the promo one.
  it("carries a supplemented trait through to a promo reprint of that card", () => {
    const dictionaries = buildDictionaries(
      resolved([["HMW_019", base()]]),
      { P26_500: "HMW_019" },
      { HMW_019: "Peridea" },
    );

    expect(dictionaries.cardTraits.HMW_019).toBe("Peridea");
    expect(dictionaries.cardTraits.P26_500).toBe("Peridea");
  });
});
