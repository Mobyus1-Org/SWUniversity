import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, pick, CSF } from "./scan-fixtures";

// SHD_090 Maul — Shadow Collective Visionary (7/6 Ground): "Ambush, Overwhelm" / "On Attack: You may
// choose another friendly Underworld unit. If you do, all combat damage that would be dealt to this
// unit during this attack is dealt to the chosen unit instead."
describe("SHD_090 Maul", () => {
  it("the defender's counter-damage goes to the chosen Underworld unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.maul).WithGroundUnitForPlayer(1, Cards.units.shd.lomPyke).WithGroundUnitForPlayer(2, CSF).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[1].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.groundArena[1].damage).toBe(3);
  });
  it("declined: Maul takes it", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.maul).WithGroundUnitForPlayer(1, Cards.units.shd.lomPyke).WithGroundUnitForPlayer(2, CSF).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(1);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });
});
