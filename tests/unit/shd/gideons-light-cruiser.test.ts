import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, prompt } from "./scan-fixtures";

// SHD_242 Gideon's Light Cruiser (7/8 Space): "Overwhelm" / "When Played: If you control Moff Gideon (as a
// leader or unit), play a [Villainy] unit that costs 3 or less from your hand or discard pile for free."
const TROOPER = Cards.units.ibh.firstLegionTrooper; // cost 3 Villainy
describe("SHD_242 Gideon's Light Cruiser", () => {
  it("with Moff Gideon leading: plays a Villainy unit from the discard for free", async () => {
    const g = load(board(Cards.leaders.shd.moffGideon).WithCardInDiscardForPlayer(1, TROOPER).WithCardInHandForPlayer(1, Cards.units.shd.gideonsLightCruiser).Build());
    await g.playCardFromHandAsync(1, 0);
    const spentBefore = g.state.player1.resources.filter(r => !r.ready).length;
    await pick(g, [g.state.player1.discard[0].playId]);
    expect(g.state.player1.groundArena.some(u => u.cardId === TROOPER)).toBe(true);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(spentBefore);
  });
  it("without Moff Gideon: nothing", async () => {
    const g = load(board().WithCardInDiscardForPlayer(1, TROOPER).WithCardInHandForPlayer(1, Cards.units.shd.gideonsLightCruiser).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)).toBeNull();
  });
});
