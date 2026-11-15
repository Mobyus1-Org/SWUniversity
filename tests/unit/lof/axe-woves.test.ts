import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XP, SHIELD, power, hp } = F;
const AXE = Cards.units.lof.axeWoves; // 2/2, Shielded

// LOF_062 Axe Woves: "This unit gets +1/+1 for each upgrade on him."
describe("LOF_062 Axe Woves", () => {
  it("+1/+1 per upgrade (on top of each upgrade's own stats)", () => {
    const g = load(board().WithGroundUnitForPlayer(1, AXE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(XP, 1), F.up(SHIELD, 1)]).Build());
    expect(power(g.state.player1.groundArena[0])).toBe(2 + 1 + 2);
    expect(hp(g.state.player1.groundArena[0])).toBe(2 + 1 + 2);
  });

  it("no upgrades: printed stats", () => {
    const g = load(board().WithGroundUnitForPlayer(1, AXE).Build());
    expect(power(g.state.player1.groundArena[0])).toBe(2);
  });
});
