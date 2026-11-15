import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, count, XP } from "./scan-fixtures";

// SHD_113 Privateer Crew (2/2 Ground): "Smuggle [6 resources, Command]" / "When played using Smuggle: Give
// 3 Experience tokens to this unit."
describe("SHD_113 Privateer Crew", () => {
  it("played using Smuggle: 3 Experience tokens", async () => {
    const g = load(board().FillResourcesForPlayer(1, Cards.units.shd.privateerCrew, 1).Build());
    await g.smuggleResourceAsync(1, 14);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(3);
  });
  it("played from hand: none", async () => {
    const g = load(board().WithCardInHandForPlayer(1, Cards.units.shd.privateerCrew).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
  });
});
