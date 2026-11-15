import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, count, CSF, XP } from "./scan-fixtures";

// SHD_075 Covert Strength (Event): "Heal 2 damage from a unit and give an Experience token to it." / Smuggle
describe("SHD_075 Covert Strength", () => {
  it("heals 2 and gives an Experience token", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF, true, 3).WithCardInHandForPlayer(1, Cards.events.shd.covertStrength).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
  });
});
