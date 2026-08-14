import { describe, it, expect } from "vitest";
import { mockToSwuAttributes } from "@/server/engine/card-db/mock-adapter";
import { createEmptyDictionaries, populateDictionaries } from "@/server/engine/card-db/generator";
import { previewRecordToMock, type PreviewRecord } from "@/server/engine/card-db/preview-client";
import type { MockCard } from "@/server/engine/card-db/card-mocks";
import ash004 from "./fixtures/ash-004.json";

function dictionariesFor(cardId: string, mock: MockCard) {
  const dictionaries = createEmptyDictionaries();
  populateDictionaries(cardId, mockToSwuAttributes(cardId, mock), dictionaries);
  return dictionaries;
}

function baseMock(overrides: Partial<MockCard> = {}): MockCard {
  return {
    title: "Test Card",
    subtitle: "",
    type: "Unit",
    type2: "",
    arena: "Ground",
    cost: 3,
    power: 2,
    hp: 4,
    upgradePower: null,
    upgradeHp: null,
    aspects: ["Command"],
    traits: ["Rebel"],
    text: "",
    epicAction: "",
    leaderUnitText: "",
    unique: false,
    rarity: "Common",
    set: "HMW",
    imageUrl: "https://example.test/cards/HMW/010.png",
    imageUrlBack: "",
    ...overrides,
  };
}

// The whole point of the adapter: a mocked card must land in the dictionaries through the same
// code an official card does, so that everything populateDictionaries derives is derived here too.
describe("mockToSwuAttributes — parity with an official record", () => {
  const mock = previewRecordToMock(ash004 as PreviewRecord);
  const withSecondSide: MockCard = { ...mock, type2: "Unit" };
  const dictionaries = dictionariesFor("ASH_004", withSecondSide);

  it("produces the same title, subtitle and set rows", () => {
    expect(dictionaries.cardTitle.ASH_004).toBe("Grand Admiral Thrawn");
    expect(dictionaries.cardSubtitle.ASH_004).toBe("Victory is Mine");
    expect(dictionaries.cardSet.ASH_004).toBe("ASH");
  });

  it("produces the same stat rows", () => {
    expect(dictionaries.cardCost.ASH_004).toBe(8);
    expect(dictionaries.cardPower.ASH_004).toBe(5);
    expect(dictionaries.cardHp.ASH_004).toBe(8);
  });

  it("joins text and epic action the way the generator does", () => {
    expect(dictionaries.cardText.ASH_004).toBe(
      "Action [Exhaust]: Attack with a unit. It gains Restore 2 for this attack if you control the same number of units as the defending player.\nEpic Action: If you control 8 or more resources, deploy this leader.",
    );
  });

  it("carries the deployed side's text as leader unit text", () => {
    expect(dictionaries.cardLeaderUnitText.ASH_004).toBe(
      "Restore 2\nOn Attack: If you control more units than the defending player, you may defeat a non-leader unit they control.",
    );
  });

  it("comma-joins aspects, traits and arena", () => {
    expect(dictionaries.cardAspects.ASH_004).toBe("Vigilance,Villainy");
    expect(dictionaries.cardTraits.ASH_004).toBe("Imperial,Official");
    expect(dictionaries.cardArena.ASH_004).toBe("Ground");
  });

  it("marks uniqueness and both card types", () => {
    expect(dictionaries.cardIsUnique.ASH_004).toBe(true);
    expect(dictionaries.cardType.ASH_004).toBe("Leader");
    expect(dictionaries.cardType2.ASH_004).toBe("Unit");
  });

  it("does not set the when-played or when-defeated flags for a card with neither", () => {
    expect(dictionaries.cardHasWhenPlayed.ASH_004).toBeUndefined();
    expect(dictionaries.cardHasWhenDefeated.ASH_004).toBeUndefined();
  });
});

describe("mockToSwuAttributes — derived flags", () => {
  it("sets the when-played flag from the card text", () => {
    const dictionaries = dictionariesFor("HMW_010", baseMock({ text: "When Played: Draw a card." }));
    expect(dictionaries.cardHasWhenPlayed.HMW_010).toBe(true);
  });

  it("sets the when-defeated flag from the card text", () => {
    const dictionaries = dictionariesFor("HMW_011", baseMock({ text: "When Defeated: Deal 1 damage." }));
    expect(dictionaries.cardHasWhenDefeated.HMW_011).toBe(true);
  });

  it("sets the when-played flag from the epic action too, since the generator joins them", () => {
    const dictionaries = dictionariesFor("HMW_012", baseMock({ epicAction: "Epic Action: When Played: nonsense." }));
    expect(dictionaries.cardHasWhenPlayed.HMW_012).toBe(true);
  });

  it("omits leader unit text for a non-leader", () => {
    const dictionaries = dictionariesFor("HMW_013", baseMock({ leaderUnitText: "ignored" }));
    expect(dictionaries.cardLeaderUnitText.HMW_013).toBeUndefined();
  });
});

// generateCardImagesFromResolvedCardsAsync gates back-image download on artBack.data being
// truthy. Get this wrong and a mocked leader silently never downloads its deployed-side art.
describe("mockToSwuAttributes — back art flag", () => {
  it("marks artBack present when the mock has a back image", () => {
    const attributes = mockToSwuAttributes("HMW_004", baseMock({ imageUrlBack: "https://example.test/b.png" }));
    expect(attributes.artBack?.data).toBeTruthy();
  });

  it("leaves artBack absent when the mock has no back image", () => {
    const attributes = mockToSwuAttributes("HMW_010", baseMock({ imageUrlBack: "" }));
    expect(attributes.artBack?.data ?? null).toBeNull();
  });
});

describe("mockToSwuAttributes — omitted values", () => {
  it("omits stat rows for null stats rather than writing zeros", () => {
    const dictionaries = dictionariesFor("HMW_014", baseMock({ cost: null, power: null, hp: null }));
    expect(dictionaries.cardCost.HMW_014).toBeUndefined();
    expect(dictionaries.cardPower.HMW_014).toBeUndefined();
    expect(dictionaries.cardHp.HMW_014).toBeUndefined();
  });

  it("omits the arena row when the mock has no arena", () => {
    const dictionaries = dictionariesFor("HMW_015", baseMock({ arena: "" }));
    expect(dictionaries.cardArena.HMW_015).toBeUndefined();
  });
});
