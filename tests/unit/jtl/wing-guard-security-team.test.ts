import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, SHIELD, count } = F;
const WGST = Cards.units.jtl.wingGuardSecurityTeam;
const OWEN = Cards.units.lof.owenLars;      // Fringe
const TRACE = Cards.units.jtl.traceMartez;  // Fringe

// JTL_072 Wing Guard Security Team: "When Played: Give a Shield token to each of up to 2 Fringe units."
describe("JTL_072 Wing Guard Security Team", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, OWEN).WithGroundUnitForPlayer(1, TRACE).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, WGST).Build());

  it("shields up to 2 Fringe units", async () => {
    const g = setup();
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId, g.state.player1.groundArena[1].playId]);
    expect(count(g.state.player1.groundArena[0], SHIELD)).toBe(1);
    expect(count(g.state.player1.groundArena[1], SHIELD)).toBe(1);
  });

  it("a non-Fringe unit is refused", async () => {
    const g = setup();
    await F.playFromHand(g);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(count(g.state.player2.groundArena[0], SHIELD)).toBe(0);
  });

  it("may choose fewer than 2", async () => {
    const g = setup();
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], SHIELD)).toBe(1);
    expect(count(g.state.player1.groundArena[1], SHIELD)).toBe(0);
  });
});
