import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, count, up, MARINE, XP } from "./scan-fixtures";

// SHD_140 Trandoshan Hunters (6/4 Ground): "Overwhelm" / "When Played: If an enemy unit has a Bounty,
// give an Experience token to this unit."
describe("SHD_140 Trandoshan Hunters", () => {
  it("an enemy unit with a Bounty: an Experience token", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.deathMark, 1)]).WithCardInHandForPlayer(1, Cards.units.shd.trandoshanHunters).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
  });
  it("none: no token", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, Cards.units.shd.trandoshanHunters).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
  });
});
