import { describe, it, expect, vi } from "vitest";

// card-mocks.json is empty in the repo, so the real module cannot exercise the mock_ branch — and
// that branch IS the release-day cutover mechanism. Stub the module so the prefixing is tested
// regardless of what happens to be mocked at any given moment.
vi.mock("@/server/engine/card-db/card-mocks", () => ({
  isMockCardId: (cardId: string) => cardId === "HMW_004",
  MOCK_CARD_IDS: ["HMW_004"],
  cardMocks: {},
}));

const { getCardImageLink, getCardSquareImageLink } = await import("@/util/func");

describe("card art paths with a card that IS mocked", () => {
  it("prefixes the full-art path", () => {
    expect(getCardImageLink("HMW_004")).toBe("/assets/cards/full/mock_HMW_004.webp");
  });

  it("prefixes the square path", () => {
    expect(getCardSquareImageLink("HMW_004")).toBe("/assets/cards/square/mock_HMW_004.webp");
  });

  // Once official data lands the entry is deleted, so the id stops being mocked and the very same
  // call resolves to official art with no other change anywhere.
  it("leaves a card that is not mocked unprefixed", () => {
    expect(getCardImageLink("HMW_005")).toBe("/assets/cards/full/HMW_005.webp");
    expect(getCardSquareImageLink("HMW_005")).toBe("/assets/cards/square/HMW_005.webp");
  });
});
