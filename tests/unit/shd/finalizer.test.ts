import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, MARINE, CSF, XWING } from "./scan-fixtures";

// SHD_092 Finalizer — Might of the First Order (11/11 Space): "Overwhelm" / "When Played: Choose any
// number of friendly units. Each of those units captures an enemy non-leader unit in the same arena."
describe("SHD_092 Finalizer", () => {
  it("each chosen friendly unit captures an enemy unit in its arena", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithSpaceUnitForPlayer(1, XWING).WithGroundUnitForPlayer(2, MARINE).WithSpaceUnitForPlayer(2, XWING).WithCardInHandForPlayer(1, Cards.units.shd.finalizer).Build());
    await g.playCardFromHandAsync(1, 0);
    const csf = g.state.player1.groundArena[0].playId;
    const myX = g.state.player1.spaceArena[0].playId;
    await pick(g, [csf, myX]);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    await pick(g, [g.state.player2.spaceArena[0].playId]);
    expect(g.state.player2.groundArena.length + g.state.player2.spaceArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
  });
  it("choosing none captures nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, Cards.units.shd.finalizer).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, []);
    expect(g.state.player2.groundArena.length).toBe(1);
  });
});
