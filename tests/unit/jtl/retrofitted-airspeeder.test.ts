import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const AIRSPEEDER = Cards.units.jtl.retrofittedAirspeeder; // 3/6 Ground
const PADAWAN = Cards.units.lof.padawanStarfighter;       // 1/3 Space

// JTL_259 Retrofitted Airspeeder: "This unit can attack space units. While attacking a space unit, this unit
// gets –1/–0."
describe("JTL_259 Retrofitted Airspeeder", () => {
  it("attacks a space unit, at –1/–0", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, AIRSPEEDER).WithSpaceUnitForPlayer(2, PADAWAN).Build());
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId);
    expect(g.state.player2.spaceArena[0].damage).toBe(2);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("full power against a ground unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, AIRSPEEDER).WithGroundUnitForPlayer(2, F.CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("a normal ground unit cannot attack a space unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(2, PADAWAN).Build());
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
});
