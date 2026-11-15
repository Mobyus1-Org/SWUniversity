import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, count, CSF, XP, GUNGAN } from "./scan-fixtures";

// SHD_084 Phase-III Dark Trooper (3/3 Ground): "Sentinel" / "When combat damage is dealt to this unit:
// Give an Experience token to this unit (if it survives the damage)."
describe("SHD_084 Phase-III Dark Trooper", () => {
  it("survives combat damage: an Experience token", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, GUNGAN).WithGroundUnitForPlayer(2, Cards.units.shd.phaseIIIDarkTrooper).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(count(g.state.player2.groundArena[0], XP)).toBe(1);
  });
  it("defeated by it: nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, Cards.units.shd.phaseIIIDarkTrooper).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena.length).toBe(0);
  });
});
