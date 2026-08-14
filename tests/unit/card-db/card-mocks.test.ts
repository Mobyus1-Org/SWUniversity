import { describe, it, expect } from "vitest";
import { cardMocks, MOCK_CARD_IDS, isMockCardId } from "@/server/engine/card-db/card-mocks";

describe("card mocks module", () => {
  it("exposes the mock records as a keyed record", () => {
    expect(typeof cardMocks).toBe("object");
    expect(cardMocks).not.toBeNull();
  });

  it("derives MOCK_CARD_IDS from the record keys", () => {
    expect(MOCK_CARD_IDS).toEqual(Object.keys(cardMocks));
  });

  it("reports a card id that is not mocked as false", () => {
    expect(isMockCardId("SOR_001")).toBe(false);
  });

  it("reports every mocked id as true", () => {
    for (const cardId of MOCK_CARD_IDS) {
      expect(isMockCardId(cardId)).toBe(true);
    }
  });

  it("keys every entry by its own set code", () => {
    for (const [cardId, mock] of Object.entries(cardMocks)) {
      expect(cardId.startsWith(`${mock.set}_`)).toBe(true);
    }
  });
});
