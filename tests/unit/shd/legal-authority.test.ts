import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, MARINE, CSF, GUNGAN } from "./scan-fixtures";

// SHD_124 Legal Authority (+0/+2, friendly unit): "When Played: Attached unit captures an enemy non-leader
// unit with less power than it."
describe("SHD_124 Legal Authority", () => {
  it("the host captures an enemy unit with less power", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, GUNGAN).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, Cards.upgrades.shd.legalAuthority).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await pick(g, [g.state.player2.groundArena[0].playId]); // the 2-power Gungan; the 3-power Marine is not less
    expect(g.state.player1.groundArena[0].captives.map(c => c.cardId)).toEqual([GUNGAN]);
  });
});
