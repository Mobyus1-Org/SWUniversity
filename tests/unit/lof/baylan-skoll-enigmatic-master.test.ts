import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const BAYLAN = Cards.units.lof.baylanSkoll;
const TURTLE = Cards.units.ash.dinosaurTurtle; // cost 6
const withForce = (s: ReturnType<ReturnType<typeof board>["Build"]>, p: 1 | 2 = 1) => { (p === 1 ? s.player1 : s.player2).supplemental.forceToken = true; return s; };

// LOF_185 Baylan Skoll: "When Played: You may use the Force. If you do, return a non-leader unit that costs 4 or less to
// its owner's hand. Then, its owner may play it for free."
describe("LOF_185 Baylan Skoll", () => {
  const setup = () => withForce(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, BAYLAN).Build());

  it("returns the unit; its owner may replay it for free", async () => {
    const g = load(setup());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    await g.chooseCardFromHandAsync(2, 0);
    expect(g.state.player2.hand).toHaveLength(0);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(g.state.player2.groundArena[0].ready).toBe(false); // a fresh play: it enters exhausted
  });

  it("the owner may decline the free play", async () => {
    const g = load(setup());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    await g.dispatchAsync(2, "choose-target", { targetZones: ["Hand"], targetPlayers: [2], targetIndices: [] });
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("a unit costing more than 4: no offer", async () => {
    const g = load(withForce(board().WithGroundUnitForPlayer(2, TURTLE).WithCardInHandForPlayer(1, BAYLAN).Build()));
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });

  it("without the Force: no offer", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, BAYLAN).Build());
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });
});
