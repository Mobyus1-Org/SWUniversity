import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load } from "./scan-fixtures";

// SHD_252 Smuggler's Aid (Event): "Heal 3 damage from your base." / Smuggle
describe("SHD_252 Smuggler's Aid", () => {
  it("heals 3 from your base", async () => {
    const g = load(board().WithCardInHandForPlayer(1, Cards.events.shd.smugglersAid).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.base.damage).toBe(7);
  });
});
