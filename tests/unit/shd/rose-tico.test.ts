import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, pick, prompt, count, up, MARINE, XP, SHIELD } from "./scan-fixtures";

// SHD_045 Rose Tico — Dedicated to the Cause (2/6 Ground): "Shielded" / "On Attack: You may defeat a
// Shield token on a friendly unit. If you do, give 2 Experience tokens to that unit."
describe("SHD_045 Rose Tico", () => {
  it("On Attack: trades a friendly unit's Shield for 2 Experience tokens", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.roseTico).WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 1, [up(SHIELD, 1)]).Build());
    await attackBase(g);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[1].playId]);
    expect(count(g.state.player1.groundArena[1], SHIELD)).toBe(0);
    expect(count(g.state.player1.groundArena[1], XP)).toBe(2);
  });
  it("can be declined", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.roseTico).WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 1, [up(SHIELD, 1)]).Build());
    await attackBase(g);
    expect(prompt(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);
    expect(count(g.state.player1.groundArena[1], SHIELD)).toBe(1);
  });
});
