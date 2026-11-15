import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING } = F;
const SNAP = Cards.units.jtl.snapWexley;               // cost 3, Resistance
const COMMANDO = Cards.units.jtl.desperateCommando;    // cost 2, Resistance
const spent = (g: ReturnType<typeof load>) => g.state.player1.resources.filter(r => !r.ready).length;

// JTL_098 Snap Wexley: "When played as a unit/On Attack: The next Resistance card you play this phase costs
// 1 resource less." / "When played as an upgrade: Search the top 5 cards of your deck for a Resistance
// card, reveal it, and draw it."
describe("JTL_098 Snap Wexley", () => {
  it("played as a unit: the next Resistance card costs 1 less (once)", async () => {
    const g = load(board().WithCardInHandForPlayer(1, SNAP).WithCardInHandForPlayer(1, COMMANDO).WithCardInHandForPlayer(1, COMMANDO).Build());
    await g.playCardFromHandAsync(1, 0); // no Vehicle in play, so no unit/pilot choice
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    expect(spent(g)).toBe(3 + 1);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    expect(spent(g)).toBe(3 + 1 + 2);
  });

  it("a non-Resistance card does not use the discount", async () => {
    const g = load(board().WithCardInHandForPlayer(1, SNAP).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, COMMANDO).Build());
    await g.playCardFromHandAsync(1, 0); // no Vehicle in play, so no unit/pilot choice
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g); // Marine, full price
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g); // Commando, 1 less
    expect(spent(g)).toBe(3 + 2 + 1);
  });

  it("On Attack: the next Resistance card costs 1 less", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, SNAP).WithCardInHandForPlayer(1, COMMANDO).Build());
    await F.attackBase(g);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g);
    expect(spent(g)).toBe(1);
  });

  it("played as an upgrade: draws a Resistance card from the top 5", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithCardInHandForPlayer(1, SNAP)
      .WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, COMMANDO).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
    const search = F.prompt(g) as unknown as { choices: { tempId: string; cardId: string }[] };
    await g.chooseDeckSearchAsync(1, [search.choices.find(c => c.cardId === COMMANDO)!.tempId]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([COMMANDO]);
  });
});
