import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, pick, power, hp, MARINE } from "./scan-fixtures";

// SHD_097 Freetown Backup (1/4 Ground): "On Attack: Give another friendly unit +2/+2 for this phase." / Smuggle
describe("SHD_097 Freetown Backup", () => {
  it("another friendly unit gets +2/+2 for this phase", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.freetownBackup).WithGroundUnitForPlayer(1, MARINE).Build());
    await attackBase(g);
    await pick(g, [g.state.player1.groundArena[1].playId]);
    expect([power(g.state.player1.groundArena[1]), hp(g.state.player1.groundArena[1])]).toEqual([5, 5]);
  });
});
