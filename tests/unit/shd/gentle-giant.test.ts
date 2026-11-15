import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, pick, prompt, CSF } from "./scan-fixtures";

// SHD_048 Gentle Giant (2/8 Ground): "Grit" / "On Attack: You may heal damage from another unit equal
// to the damage on this unit."
describe("SHD_048 Gentle Giant", () => {
  it("heals another unit by the damage on the Giant", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.gentleGiant, true, 3).WithGroundUnitForPlayer(1, CSF, true, 4).Build());
    await attackBase(g);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[1].playId]);
    expect(g.state.player1.groundArena[1].damage).toBe(1);
    expect(g.state.player1.groundArena[0].damage).toBe(3); // not itself
  });
  it("with no damage on the Giant, nothing is asked", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.gentleGiant).WithGroundUnitForPlayer(1, CSF, true, 4).Build());
    await attackBase(g);
    expect(prompt(g)).toBeNull();
  });
});
