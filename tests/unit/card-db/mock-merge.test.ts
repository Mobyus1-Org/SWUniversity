import { describe, it, expect } from "vitest";
import { mergeMocksIntoResolvedCards, mockArtFileName } from "@/server/engine/card-db/generator";
import { mockToSwuAttributes } from "@/server/engine/card-db/mock-adapter";
import type { SwuCardAttributes } from "@/server/engine/card-db/swu-api-types";
import type { MockCard } from "@/server/engine/card-db/card-mocks";

function mock(title: string): MockCard {
  return {
    title,
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
  };
}

describe("mergeMocksIntoResolvedCards", () => {
  it("adds a mock-only card to the resolved map", () => {
    const resolved = new Map<string, SwuCardAttributes>();
    const report = mergeMocksIntoResolvedCards(resolved, { HMW_010: mock("Mocked Card") });

    expect(resolved.get("HMW_010")?.title).toBe("Mocked Card");
    expect(report.appliedMockIds).toEqual(["HMW_010"]);
    expect(report.supersededMockIds).toEqual([]);
  });

  // Official data always wins. On release day an ordinary regen switches every card over and
  // reports what to clean up.
  it("ignores a mock whose id is already present from the official API", () => {
    const official = mockToSwuAttributes("HMW_010", mock("Official Card"));
    const resolved = new Map<string, SwuCardAttributes>([["HMW_010", official]]);
    const report = mergeMocksIntoResolvedCards(resolved, { HMW_010: mock("Mocked Card") });

    expect(resolved.get("HMW_010")?.title).toBe("Official Card");
    expect(report.appliedMockIds).toEqual([]);
    expect(report.supersededMockIds).toEqual(["HMW_010"]);
  });

  it("applies some mocks while superseding others in the same run", () => {
    const resolved = new Map<string, SwuCardAttributes>([
      ["HMW_010", mockToSwuAttributes("HMW_010", mock("Official Card"))],
    ]);
    const report = mergeMocksIntoResolvedCards(resolved, {
      HMW_010: mock("Superseded"),
      HMW_011: mock("Still Mocked"),
    });

    expect(report.appliedMockIds).toEqual(["HMW_011"]);
    expect(report.supersededMockIds).toEqual(["HMW_010"]);
    expect(resolved.size).toBe(2);
  });

  it("is a no-op when there are no mocks", () => {
    const resolved = new Map<string, SwuCardAttributes>();
    const report = mergeMocksIntoResolvedCards(resolved, {});

    expect(resolved.size).toBe(0);
    expect(report.appliedMockIds).toEqual([]);
    expect(report.supersededMockIds).toEqual([]);
  });
});

// The prefix is what makes release-day cutover automatic: official art has no file to skip, so it
// downloads normally, and the mock_ files become dead and get pruned.
describe("mockArtFileName", () => {
  it("prefixes the front art file", () => {
    expect(mockArtFileName("HMW_004")).toBe("mock_HMW_004.webp");
  });

  it("prefixes the back art file", () => {
    expect(mockArtFileName("HMW_004", "_BACK")).toBe("mock_HMW_004_BACK.webp");
  });
});
