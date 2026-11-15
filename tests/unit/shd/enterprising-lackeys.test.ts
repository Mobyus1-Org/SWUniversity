import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, pick, MARINE, CSF } from "./scan-fixtures";

// SHD_107 Enterprising Lackeys (5/5 Ground): "When Defeated: You may defeat a friendly resource. If you do,
// put this unit into play as a resource." / Smuggle
describe("SHD_107 Enterprising Lackeys", () => {
  it("swaps a resource for itself", async () => {
    const g = load(board().FillResourcesForPlayer(2, MARINE, 3).WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, Cards.units.shd.enterprisingLackeys, true, 2).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(2);
    await pick(g, [g.state.player2.resources[0].playId], 2);
    expect(g.state.player2.resources.length).toBe(3);
    expect(g.state.player2.resources.some(r => r.cardId === Cards.units.shd.enterprisingLackeys)).toBe(true);
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.shd.enterprisingLackeys)).toBe(false);
  });
});
