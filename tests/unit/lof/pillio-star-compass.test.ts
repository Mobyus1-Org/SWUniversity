import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const COMPASS = Cards.upgrades.lof.pillioStarCompass;
const DIVERSION = Cards.events.jtl.diversion;

// LOF_122 Pillio Star Compass: "When Played: Search the top 3 cards of your deck for a unit, reveal it, and draw it."
describe("LOF_122 Pillio Star Compass", () => {
  it("draws a unit from the top 3", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, COMPASS)
      .WithCardInDeckForPlayer(1, CSF).WithCardInDeckForPlayer(1, DIVERSION).WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, DIVERSION).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([COMPASS]);
    const search = F.prompt(g) as unknown as { choices: { tempId: string; cardId: string }[] };
    expect(search.choices.map(c => c.cardId)).toEqual([MARINE]); // the CSF is 4th from the top
    await g.chooseDeckSearchAsync(1, [search.choices[0].tempId]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.deck).toHaveLength(3);
  });
});
