import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const HUX = Cards.units.jtl.generalHux;                     // 1/4
const STORMTROOPER = Cards.units.jtl.firstOrderStormtrooper; // 2/1 First Order, cost 1
const TAM = Cards.units.jtl.tamRyvora;                       // 2/5 First Order, no On Attack of her own

// JTL_134 General Hux: "Each other friendly First Order unit gains Raid 1." / "Action [Exhaust]: If you
// played a First Order card this phase, draw a card."
describe("JTL_134 General Hux", () => {
  it("another friendly First Order unit gains Raid 1", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TAM).WithGroundUnitForPlayer(1, HUX).Build());
    await F.attackBase(g, 0);
    expect(g.state.player2.base.damage).toBe(10 + 3);
  });

  it("Hux himself does not gain Raid", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, HUX).Build());
    await F.attackBase(g, 0);
    expect(g.state.player2.base.damage).toBe(10 + 1);
  });

  it("Action: draws after you played a First Order card this phase", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, HUX).WithCardInHandForPlayer(1, STORMTROOPER).WithCardInDeckForPlayer(1, MARINE).Build());
    await F.playFromHand(g);
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "use-ability", { cardId: HUX, playId: g.state.player1.groundArena[0].playId });
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("Action: no First Order card played — exhausts, draws nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, HUX).WithCardInHandForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE).Build());
    await F.playFromHand(g);
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "use-ability", { cardId: HUX, playId: g.state.player1.groundArena[0].playId });
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
