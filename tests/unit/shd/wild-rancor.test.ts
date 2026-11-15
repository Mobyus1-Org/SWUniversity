import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, CSF, XWING, GUNGAN } from "./scan-fixtures";

// SHD_158 Wild Rancor (6/8 Ground): "Overwhelm" / "When Played: Deal 2 damage to each other ground unit."
describe("SHD_158 Wild Rancor", () => {
  it("2 damage to each other ground unit, both sides; space untouched", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, GUNGAN).WithSpaceUnitForPlayer(2, XWING).WithCardInHandForPlayer(1, Cards.units.shd.wildRancor).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.groundArena.find(u => u.cardId === CSF)!.damage).toBe(2);
    expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.wildRancor)!.damage).toBe(0);
    expect(g.state.player2.groundArena.length).toBe(0); // the 2/2 died
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
});
