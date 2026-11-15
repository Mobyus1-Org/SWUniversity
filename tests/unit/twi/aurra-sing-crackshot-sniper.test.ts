import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING } = F;

// TWI_166 Aurra Sing — Crackshot Sniper (7/6): "Overwhelm" / "When an enemy ground unit attacks your base: Ready this unit."
describe("TWI_166 Aurra Sing", () => {
  it("readies when an enemy ground unit attacks her controller's base", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, Cards.units.twi.aurraSingCrackshot, false).Build());
    await F.attackBase(g);
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });
  it("a space attacker doesn't wake her", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithGroundUnitForPlayer(2, Cards.units.twi.aurraSingCrackshot, false).Build());
    await F.attackBase(g, 0, "space");
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
});
