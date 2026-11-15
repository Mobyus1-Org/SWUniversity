import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING, power } = F;
const IG88 = Cards.units.jtl.ig88; // 4/5; as a pilot +0/+3

// JTL_141 IG-88: "While an enemy unit is damaged, this unit gets +3/+0." / attached unit gains the same.
describe("JTL_141 IG-88", () => {
  it("+3/+0 while an enemy unit is damaged", () => {
    const g = load(board().WithGroundUnitForPlayer(1, IG88).WithGroundUnitForPlayer(2, MARINE, true, 1).Build());
    expect(power(g.state.player1.groundArena[0])).toBe(7);
  });

  it("no bonus when only a friendly unit is damaged", () => {
    const g = load(board().WithGroundUnitForPlayer(1, IG88).WithGroundUnitForPlayer(1, MARINE, true, 1).WithGroundUnitForPlayer(2, MARINE).Build());
    expect(power(g.state.player1.groundArena[0])).toBe(4);
  });

  it("the Vehicle he pilots gets +3/+0 while an enemy unit is damaged", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(IG88, 1)]).WithGroundUnitForPlayer(2, MARINE, true, 1).Build());
    expect(power(g.state.player1.spaceArena[0])).toBe(2 + 3);
  });

  it("the piloted Vehicle has no bonus with no damaged enemy", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(IG88, 1)]).WithGroundUnitForPlayer(2, MARINE).Build());
    expect(power(g.state.player1.spaceArena[0])).toBe(2);
  });
});
