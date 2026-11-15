import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const CRUISER = Cards.units.hmw.monCalCruiser;

// HMW_232 Mon Cal Cruiser: "When Played: Choose one: Attack with a unit. It gets +2/+0 for this attack. / Look at an
// opponent's hand. You may discard a card from it. If you do, they draw a card."
describe("HMW_232 Mon Cal Cruiser", () => {
  it("attack mode: a unit attacks with +2/+0", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, CRUISER).Build());
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "attack");
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(10 + 5);
  });

  it("look mode: discard a card from their hand; they draw", async () => {
    const g = load(board().WithCardInHandForPlayer(1, CRUISER).WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, CSF).WithCardInDeckForPlayer(2, MARINE).Build());
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "look");
    await g.dispatchAsync(1, "choose-target", { targetIndices: [1] });
    expect(g.state.player2.discard.map(c => c.cardId)).toEqual([CSF]);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE, MARINE]);
  });

  it("look mode: discarding nothing means no draw", async () => {
    const g = load(board().WithCardInHandForPlayer(1, CRUISER).WithCardInHandForPlayer(2, MARINE).WithCardInDeckForPlayer(2, MARINE).Build());
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "look");
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });
    expect(g.state.player2.hand).toHaveLength(1);
  });
});
