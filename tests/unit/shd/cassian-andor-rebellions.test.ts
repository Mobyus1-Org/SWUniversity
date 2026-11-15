import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load } from "./scan-fixtures";

// SHD_148 Cassian Andor — Rebellions Are Built On Hope (3/5 Ground): Smuggle / "When played using
// Smuggle: Ready this unit."
describe("SHD_148 Cassian Andor", () => {
  it("played using Smuggle: enters ready", async () => {
    const g = load(board().FillResourcesForPlayer(1, Cards.units.shd.cassianAndorRebellions, 1).Build());
    await g.smuggleResourceAsync(1, 14);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });
  it("played from hand: exhausted", async () => {
    const g = load(board().WithCardInHandForPlayer(1, Cards.units.shd.cassianAndorRebellions).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
