import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, power, hp } = F;
const PARTAGAZ = Cards.units.sec.majorPartagaz;   // 0/6
const PELLAEON = Cards.units.ash.captainPellaeon; // Official

// SEC_081 Major Partagaz: "When another friendly Official unit attacks: This unit gets +2/+2 for this phase."
describe("SEC_081 Major Partagaz", () => {
  it("another friendly Official attacking: +2/+2 for the phase", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, PELLAEON).WithGroundUnitForPlayer(1, PARTAGAZ).Build());
    await F.attackBase(g, 0);
    const p = g.state.player1.groundArena[1];
    expect([power(p), hp(p)]).toEqual([2, 8]);
  });

  it("a non-Official attacking: nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, PARTAGAZ).Build());
    await F.attackBase(g, 0);
    expect(power(g.state.player1.groundArena[1])).toBe(0);
  });
});
