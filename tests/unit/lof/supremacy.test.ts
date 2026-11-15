import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XWING, power, hp } = F;
const SUPREMACY = Cards.units.lof.supremacy; // 12/12

// LOF_089 Supremacy: "Other friendly Vehicle units get +6/+6."
describe("LOF_089 Supremacy", () => {
  it("other friendly Vehicles get +6/+6; enemy ones and Supremacy itself do not", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, SUPREMACY).WithSpaceUnitForPlayer(1, XWING).WithSpaceUnitForPlayer(2, XWING).Build());
    const [sup, mine] = g.state.player1.spaceArena;
    expect([power(mine), hp(mine)]).toEqual([8, 8]);
    expect([power(sup), hp(sup)]).toEqual([12, 12]);
    expect(power(g.state.player2.spaceArena[0])).toBe(2);
  });

  it("a non-Vehicle unit gets nothing", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, SUPREMACY).WithGroundUnitForPlayer(1, F.MARINE).Build());
    expect(power(g.state.player1.groundArena[0])).toBe(3);
  });
});
