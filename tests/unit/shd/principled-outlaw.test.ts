import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, pick, CSF } from "./scan-fixtures";

// SHD_201 Principled Outlaw (4/4 Ground): "On Attack: You may exhaust a ground unit." / Smuggle
describe("SHD_201 Principled Outlaw", () => {
  it("exhausts a ground unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.principledOutlaw).WithGroundUnitForPlayer(2, CSF).Build());
    await attackBase(g);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
});
