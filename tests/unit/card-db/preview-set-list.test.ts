import { describe, it, expect } from "vitest";
import { previewSetListFromResponse, type PreviewRecord } from "@/server/engine/card-db/preview-client";
import ashSetInfo from "./fixtures/ash-setinfo.json";

describe("previewSetListFromResponse — group filtering", () => {
  const entries = previewSetListFromResponse("ASH", ashSetInfo as PreviewRecord);

  // The response carries six printing groups (Normal, Hyperspace, Hyperfoil, Showcase, Prestige,
  // Prestige Foil). All but Normal are alternate art of the same cards — importing them would
  // produce duplicate mocks for card numbers that are not real separate cards.
  it("reads only the Normal group", () => {
    const normal = (ashSetInfo as { printingGroups: Array<{ header: string; printings: unknown[] }> })
      .printingGroups.find((group) => group.header === "Normal");
    expect(entries).toHaveLength(normal!.printings.length);
  });

  it("maps card number and name", () => {
    expect(entries[0].cardNumber).toBe("001");
    expect(entries[0].cardName).toBe("The Armorer");
  });

  it("builds the ordinary SET_NNN card id", () => {
    expect(entries[0].cardId).toBe("ASH_001");
  });

  it("builds an absolute thumbnail URL", () => {
    expect(entries[0].imageUrl).toBe("https://swudb.com/cdn-cgi/image/quality=95/images/cards/ASH/001.png");
  });
});

describe("previewSetListFromResponse — card id padding", () => {
  function payload(cardNumber: string) {
    return {
      printingGroups: [
        { header: "Normal", printings: [{ cardName: "X", cardNumber, frontImagePath: "" }] },
      ],
    } as unknown as PreviewRecord;
  }

  // The endpoint returns numbers unpadded in places (a child expansion comes back with "2"), so
  // the id must go through the padder rather than being concatenated raw.
  it("pads a bare number to the set's width", () => {
    expect(previewSetListFromResponse("ASH", payload("2"))[0].cardId).toBe("ASH_002");
  });

  it("pads a two-digit set to two digits", () => {
    expect(previewSetListFromResponse("TS26", payload("9"))[0].cardId).toBe("TS26_09");
  });

  it("uppercases the set code", () => {
    expect(previewSetListFromResponse("ash", payload("1"))[0].cardId).toBe("ASH_001");
  });
});

describe("previewSetListFromResponse — malformed payloads", () => {
  it("returns an empty list when there are no printing groups", () => {
    expect(previewSetListFromResponse("ASH", {} as PreviewRecord)).toEqual([]);
  });

  it("returns an empty list when there is no Normal group", () => {
    const payload = { printingGroups: [{ header: "Prestige", printings: [{ cardName: "X", cardNumber: "1" }] }] };
    expect(previewSetListFromResponse("ASH", payload as unknown as PreviewRecord)).toEqual([]);
  });

  it("skips printings with no card number", () => {
    const payload = {
      printingGroups: [{ header: "Normal", printings: [{ cardName: "X", cardNumber: "" }, { cardName: "Y", cardNumber: "3" }] }],
    };
    const entries = previewSetListFromResponse("ASH", payload as unknown as PreviewRecord);
    expect(entries).toHaveLength(1);
    expect(entries[0].cardId).toBe("ASH_003");
  });

  it("returns an empty thumbnail URL when the printing has no image path", () => {
    const payload = { printingGroups: [{ header: "Normal", printings: [{ cardName: "X", cardNumber: "1" }] }] };
    expect(previewSetListFromResponse("ASH", payload as unknown as PreviewRecord)[0].imageUrl).toBe("");
  });
});
