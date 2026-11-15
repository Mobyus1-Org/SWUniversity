import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, prompt, power, CSF } from "./scan-fixtures";

// SHD_215 Smuggler's Starfighter (2/2 Space): "When Played: If you control another Underworld unit, give
// an enemy unit –3/–0 for this phase." / Smuggle
describe("SHD_215 Smuggler's Starfighter", () => {
  it("with another Underworld unit: an enemy unit gets –3/–0", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.lomPyke).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.shd.smugglersStarfighter).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(power(g.state.player2.groundArena[0])).toBe(0);
  });
  it("without one: nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.shd.smugglersStarfighter).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)).toBeNull();
  });
});
