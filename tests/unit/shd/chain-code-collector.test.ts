import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, prompt, up, MARINE } from "./scan-fixtures";

// SHD_216 Chain Code Collector (4/2 Ground): "Ambush" / "On Attack: If the defender has a Bounty, it gets
// –4/–0 for this attack."
describe("SHD_216 Chain Code Collector", () => {
  it("a Bounty defender deals no counter-damage", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.chainCodeCollector).WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.deathMark, 1)]).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    if (prompt(g)?.type === "Option") await g.chooseNoAsync(1); // skip collecting the Bounty
    expect(g.state.player1.groundArena[0]?.cardId).toBe(Cards.units.shd.chainCodeCollector);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });
  it("control: without a Bounty, the 3/3 kills it", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.chainCodeCollector).WithGroundUnitForPlayer(2, MARINE).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena.length).toBe(0);
  });
});
