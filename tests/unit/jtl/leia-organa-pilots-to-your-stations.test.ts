import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const LEIA = Cards.units.jtl.leiaOrgana;
const TRACE = Cards.units.jtl.traceMartez; // Pilot unit, 2/5

// JTL_097 Leia Organa: "When Played: You may attack with a Pilot unit or a unit with a Pilot on it. It gets
// +1/+0 and gains Restore 1 for this attack."
describe("JTL_097 Leia Organa (Pilots, To Your Stations)", () => {
  it("the Pilot unit attacks with +1/+0 and Restore 1", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TRACE).WithCardInHandForPlayer(1, LEIA).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(10 + 3);
    expect(g.state.player1.base.damage).toBe(10 - 1);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("a unit with a Pilot on it qualifies too", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, F.XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(TRACE, 1)]).WithCardInHandForPlayer(1, LEIA).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.spaceArena[0].playId]);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(10 + 2 + 1 + 1);
  });

  it("a non-Pilot unit is not offered", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, LEIA).Build());
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });

  it("declining attacks with nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TRACE).WithCardInHandForPlayer(1, LEIA).Build());
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.base.damage).toBe(10);
  });
});
