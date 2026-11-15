import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, CSF } from "./scan-fixtures";

// SHD_219 Enfys Nest — Marauder (5/4 Ground): "Ambush" / "While a friendly unit (including this one) is
// attacking using Ambush, the defender gets –3/–0."
describe("SHD_219 Enfys Nest", () => {
  it("her own Ambush attack: the 3/7 deals no counter-damage", async () => {
    const g = load(board(Cards.leaders.sor.sabineWren).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.shd.enfysNestMarauder).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });
});
