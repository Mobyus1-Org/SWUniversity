import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, MARINE, CSF } from "./scan-fixtures";

// SHD_220 Fennec Shand — Loyal Sharpshooter (4/6 Ground): "Ambush" / "On Attack: Deal 1 damage to the
// defender (if it's a unit) for each different cost among cards in your discard pile."
describe("SHD_220 Fennec Shand", () => {
  it("2 distinct costs in the discard: 2 damage before combat, then combat", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.fennecShandLoyal).WithGroundUnitForPlayer(2, CSF)
      .WithCardInDiscardForPlayer(1, MARINE).WithCardInDiscardForPlayer(1, MARINE).WithCardInDiscardForPlayer(1, CSF).WithCardInDiscardForPlayer(1, Cards.units.shd.kuiil).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    // 2 (Marine ×2), 4 (CSF), 2 (Kuiil) → costs {2, 4} = 2 distinct; then 4 combat damage.
    expect(g.state.player2.groundArena[0].damage).toBe(2 + 4);
  });
});
