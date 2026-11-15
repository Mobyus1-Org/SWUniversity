import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, MARINE } from "./scan-fixtures";

// SHD_249 Wookiee Warrior (2/5 Ground): "Grit" / "When Played: If you control another Wookiee unit, draw a card."
describe("SHD_249 Wookiee Warrior", () => {
  it("draws with another Wookiee", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.tarfful).WithCardInDeckForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.units.shd.wookieeWarrior).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.hand.length).toBe(1);
  });
  it("doesn't count itself", async () => {
    const g = load(board().WithCardInDeckForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.units.shd.wookieeWarrior).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.hand.length).toBe(0);
  });
});
