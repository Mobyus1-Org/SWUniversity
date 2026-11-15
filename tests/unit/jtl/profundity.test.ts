import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const PROFUNDITY = Cards.units.jtl.profundity; // 8/9 Space, cost 9
const TANTIVE = Cards.units.jtl.tantiveIV;
const discardP2 = (g: ReturnType<typeof load>, idx: number[]) =>
  g.dispatchAsync(2, "choose-target", { targetZones: ["Hand"], targetPlayers: [2], targetIndices: idx });

// JTL_154 Profundity: "When Played/When Defeated: Choose a player. They discard a card from their hand.
// Then, if they have more cards in their hand than you, they discard a card from their hand."
describe("JTL_154 Profundity", () => {
  const hand2 = (b: ReturnType<typeof board>, n: number) => { for (let i = 0; i < n; i++) b = b.WithCardInHandForPlayer(2, MARINE); return b; };

  it("When Played: an opponent with more cards discards twice", async () => {
    const g = load(hand2(board().FillResourcesForPlayer(1, MARINE, 16).WithCardInHandForPlayer(1, PROFUNDITY), 3).Build());
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "opponent");
    await discardP2(g, [0]);
    expect(g.state.player2.hand).toHaveLength(2);
    await discardP2(g, [0]); // one card per pick
    expect(g.state.player2.hand).toHaveLength(1);
  });

  it("an opponent no longer ahead after the first discard discards once", async () => {
    const g = load(hand2(board().FillResourcesForPlayer(1, MARINE, 16).WithCardInHandForPlayer(1, PROFUNDITY).WithCardInHandForPlayer(1, MARINE), 2).Build());
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "opponent");
    await discardP2(g, [0]);
    expect(g.state.player2.hand).toHaveLength(1);
    expect(F.prompt(g)).toBeNull();
  });

  it("choosing yourself discards one of your own cards", async () => {
    const g = load(board().FillResourcesForPlayer(1, MARINE, 16).WithCardInHandForPlayer(1, PROFUNDITY).WithCardInHandForPlayer(1, MARINE).Build());
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "self");
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("When Defeated: the same choice", async () => {
    const g = load(hand2(board().WithSpaceUnitForPlayer(1, PROFUNDITY, true, 8).WithSpaceUnitForPlayer(2, TANTIVE), 1).Build());
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    await g.chooseOptionAsync(1, "opponent");
    await discardP2(g, [0]);
    expect(g.state.player2.hand).toHaveLength(0);
  });
});
