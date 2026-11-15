import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, prompt, CSF } from "./scan-fixtures";

// SHD_050 Chewbacca — Pykesbane (4/10 Ground): "Grit" / "When Played: You may defeat a unit with 5 or less
// remaining HP." / Smuggle
describe("SHD_050 Chewbacca — Pykesbane", () => {
  it("defeats a unit with 5 or less remaining HP", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF, true, 2).WithCardInHandForPlayer(1, Cards.units.shd.chewbaccaPykesbane).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena.length).toBe(0);
  });
  it("a unit with 6 remaining HP is out of range", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF, true, 1).WithCardInHandForPlayer(1, Cards.units.shd.chewbaccaPykesbane).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)).toBeNull();
  });
});
