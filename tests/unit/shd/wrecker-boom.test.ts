import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, CSF } from "./scan-fixtures";

// SHD_154 Wrecker — Boom! (7/6 Ground): "Overwhelm" / "When Played: You may defeat a friendly resource.
// If you do, deal 5 damage to a ground unit."
describe("SHD_154 Wrecker", () => {
  it("defeats a resource, then 5 damage to a ground unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.shd.wreckerBoom).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.resources[0].playId]);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player1.resources.length).toBe(13);
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });
  it("declined: nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.shd.wreckerBoom).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);
    expect(g.state.player1.resources.length).toBe(14);
  });
});
