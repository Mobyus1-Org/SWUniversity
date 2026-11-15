import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE } = F;

// TWI_050 Luminara Unduli (4/9): "Coordinate — Grit" / "When Played: Choose a base. Heal 1 damage from it for each unit you control."
describe("TWI_050 Luminara Unduli", () => {
  it("heals your base 1 per unit you control (her included)", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.units.twi.luminaraUnduliSoftSpoken).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, ["player1.base"]);
    expect(g.state.player1.base.damage).toBe(7);
  });
});
