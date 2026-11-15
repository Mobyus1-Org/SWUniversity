import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, XWING } = F;
const MANDO = Cards.units.jtl.theMandalorianPilot;
const asPilot = async (g: ReturnType<typeof load>, arena: "space" | "ground" = "space", idx = 0) => {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseOptionAsync(1, "Play as Pilot");
  if (arena === "space") await g.choosePilotVehicleSpaceAsync(1, idx); else await g.choosePilotVehicleGroundAsync(1, idx);
};

// JTL_210 The Mandalorian: "When played as a unit: Exhaust up to 2 ground units." / "When played as an
// upgrade: Exhaust an enemy unit in this arena."
describe("JTL_210 The Mandalorian (Weathered Pilot)", () => {
  it("as a unit: exhausts up to 2 ground units", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, MANDO).Build());
    await g.playCardFromHandAsync(1, 0); // no Vehicle in play, so no unit/pilot choice
    await F.pick(g, [g.state.player2.groundArena[0].playId, g.state.player2.groundArena[1].playId]);
    expect(g.state.player2.groundArena.map(u => u.ready)).toEqual([false, false, true]);
  });

  it("as an upgrade: exhausts an enemy unit in the Vehicle's arena", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithSpaceUnitForPlayer(2, XWING).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, MANDO).Build());
    await asPilot(g);
    await F.pick(g, [g.state.player2.spaceArena[0].playId]);
    expect(g.state.player2.spaceArena[0].ready).toBe(false);
  });

  it("as an upgrade: a unit in the other arena is refused", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithSpaceUnitForPlayer(2, XWING).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, MANDO).Build());
    await asPilot(g);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });
});
