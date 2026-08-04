import { describe, it, expect } from "vitest";
// `@` aliases to ./src only, so pages/ must be reached relatively.
import handler from "../../../pages/api/internal/card-catalog";
import type { NextApiRequest, NextApiResponse } from "next";
import type { CardCatalogEntry } from "@/components/Shared/PuzzleBuilderPanel";

// QA: "Surprise Strike (SHD) — the SOR version works, but there's no way to tell which is which
// when adding to hand." Two distinct cards, same title, neither with a subtitle, and the picker
// renders only the label.

function fetchCatalog(): CardCatalogEntry[] {
  let payload: { cards: CardCatalogEntry[] } | undefined;
  const res = {
    status: () => res,
    json: (body: unknown) => { payload = body as { cards: CardCatalogEntry[] }; return res; },
  } as unknown as NextApiResponse;
  handler({ method: "GET" } as NextApiRequest, res);
  return payload!.cards;
}

describe("puzzle builder card catalog — label disambiguation", () => {
  const cards = fetchCatalog();
  const byId = (cardId: string) => cards.find(c => c.cardId === cardId)!;

  it("distinguishes the two Surprise Strikes by set code", () => {
    expect(byId("SOR_220").label).toBe("Surprise Strike (SOR)");
    expect(byId("SHD_231").label).toBe("Surprise Strike (SHD)");
  });

  it("leaves a card with a unique label untouched", () => {
    expect(byId("SEC_109").label).toBe("Diplomatic Envoy");
  });

  it("keeps the title — subtitle form for cards that have a subtitle", () => {
    expect(byId("SEC_048").label).toBe("Captain Rex — Into the Firefight");
  });

  it("no two entries from DIFFERENT sets share a label", () => {
    // Sets like IBH print several identical copies of a card under different ids; those are the
    // same card and choosing either is equivalent, so a shared label there is harmless. A label
    // shared ACROSS sets is the actual defect — two different cards, indistinguishable.
    const seen = new Map<string, string[]>();
    for (const c of cards) seen.set(c.label, [...(seen.get(c.label) ?? []), c.cardId]);

    const crossSet = [...seen.entries()].filter(([, ids]) =>
      new Set(ids.map(id => id.split("_")[0])).size > 1);
    expect(crossSet).toEqual([]);
  });

  it("every entry still has a non-empty label and a type", () => {
    expect(cards.every(c => c.label.trim().length > 0 && !!c.type)).toBe(true);
  });
});
