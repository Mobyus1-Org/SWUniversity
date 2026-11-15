import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token

// TWI_130 Bo-Katan Kryze (2/3): Overwhelm & Saboteur with another Mandalorian / "While you control another Trooper unit, this unit gets +1/+0."
describe("TWI_130 Bo-Katan Kryze", () => {
  it("+1/+0 with another Trooper", () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.boKatanDeathWatch).WithGroundUnitForPlayer(1, CLONE).Build());
    expect(F.power(g.state.player1.groundArena[0])).toBe(3);
  });
  it("none without one", () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.boKatanDeathWatch).WithGroundUnitForPlayer(1, Cards.units.shd.kuiil).Build());
    expect(F.power(g.state.player1.groundArena[0])).toBe(2); // Kuiil is Fringe, not a Trooper
  });
});
