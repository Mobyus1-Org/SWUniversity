import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, prompt, MARINE } from "./scan-fixtures";
import type { NeedsDeckSearch } from "@/lib/engine/message-types";

// SHD_127 Commission (Event): "Search the top 10 cards of your deck for a Bounty Hunter, Item, or
// Transport card, reveal it, and draw it." / Smuggle
describe("SHD_127 Commission", () => {
  it("offers only Bounty Hunter / Item / Transport cards and draws the one chosen", async () => {
    const g = load(board().WithCardInDeckForPlayer(1, Cards.units.sor.bosskDeadlyStalker).WithCardInDeckForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.events.shd.commission).Build());
    await g.playCardFromHandAsync(1, 0);
    const search = prompt(g) as NeedsDeckSearch;
    expect(search.choices.map(c => c.cardId)).toEqual([Cards.units.sor.bosskDeadlyStalker]);
    await g.chooseDeckSearchAsync(1, [search.choices[0].tempId]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([Cards.units.sor.bosskDeadlyStalker]);
  });
});
