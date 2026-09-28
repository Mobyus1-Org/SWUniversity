import { describe, it, expect } from "vitest";
import { fetchPreviewCardAsync, parsePreviewLink, previewRecordToMock } from "@/server/engine/card-db/preview-client";

// TEMPORARY: hits the live endpoint to verify the exact composition the API route performs.
// Deleted immediately after running — the committed suite never makes live HTTP calls.
describe("live preview fetch", () => {
  it("resolves a link all the way to a mock", async () => {
    const parsed = parsePreviewLink("https://swudb.com/card/ASH/004");
    expect(parsed).toEqual({ set: "ASH", number: "004" });

    const record = await fetchPreviewCardAsync(parsed!.set, parsed!.number);
    expect(record).not.toBeNull();

    const mock = previewRecordToMock(record!);
    console.log(JSON.stringify({ cardId: `${parsed!.set}_${parsed!.number}`, mock }, null, 2));
    expect(mock.title).toBe("Grand Admiral Thrawn");
  }, 30000);

  it("returns null for a card number that does not exist", async () => {
    expect(await fetchPreviewCardAsync("ASH", "999")).toBeNull();
  }, 30000);
});
