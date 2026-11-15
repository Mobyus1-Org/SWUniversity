import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick } = F;

// JTL_038 Corvus — Inferno Squadron Raider (4/5 Space): "Restore 2" / "When Played: You may attach a friendly Pilot
// unit or upgrade to this unit. (Defeat all upgrades on that Pilot and remove all damage from it.)"
describe("JTL_038 Corvus", () => {
  it("a friendly Pilot unit becomes Corvus's Pilot", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.jtl.paigeTico, true, 1).WithCardInHandForPlayer(1, Cards.units.jtl.corvus).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player1.spaceArena[0].upgrades.map(u => u.cardId)).toContain(Cards.units.jtl.paigeTico);
  });
});
