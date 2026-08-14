import { describe, it, expect } from "vitest";
import { getCardImageLink, getCardSquareImageLink } from "@/util/func";
import { MOCK_CARD_IDS } from "@/server/engine/card-db/card-mocks";

describe("card art paths for cards that are not mocked", () => {
  it("returns the plain full-art path", () => {
    expect(getCardImageLink("SOR_001")).toBe("/assets/cards/full/SOR_001.webp");
  });

  it("returns the plain square path", () => {
    expect(getCardSquareImageLink("SOR_001")).toBe("/assets/cards/square/SOR_001.webp");
  });

  it("leaves a back-art pattern alone", () => {
    expect(getCardImageLink("SOR_001_BACK")).toBe("/assets/cards/full/SOR_001_BACK.webp");
  });
});

// The mock_ prefix is applied off the card-mocks record, not the file system: deleting the entry
// on release day is all it takes for these to resolve to official art.
describe("card art paths for mocked cards", () => {
  it("prefixes every currently mocked id", () => {
    for (const cardId of MOCK_CARD_IDS) {
      expect(getCardImageLink(cardId)).toBe(`/assets/cards/full/mock_${cardId}.webp`);
      expect(getCardSquareImageLink(cardId)).toBe(`/assets/cards/square/mock_${cardId}.webp`);
    }
  });
});
