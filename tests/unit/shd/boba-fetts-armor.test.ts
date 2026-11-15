import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, up, CSF } from "./scan-fixtures";

// SHD_224 Boba Fett's Armor (+2/+2, non-Vehicle): "If attached unit is Boba Fett and damage would be dealt
// to him, prevent 2 of that damage."
const BOBA = Cards.units.sor.bobaFettDisintegrator;
describe("SHD_224 Boba Fett's Armor", () => {
  it("on Boba Fett: 2 of the counter-damage is prevented", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, BOBA).WithUpgradesOnGroundUnitForPlayer(1, 0, [up(Cards.upgrades.shd.bobaFettsArmor, 1)]).WithGroundUnitForPlayer(2, CSF).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });
  it("on anyone else: nothing prevented", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithUpgradesOnGroundUnitForPlayer(1, 0, [up(Cards.upgrades.shd.bobaFettsArmor, 1)]).WithGroundUnitForPlayer(2, CSF).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });
});
