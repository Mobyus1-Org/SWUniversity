import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF, GUNGAN } = F;

// TWI_164 Hevy (4/4): "Coordinate — Raid 2" / "When Defeated: Deal 1 damage to each enemy ground unit."
describe("TWI_164 Hevy", () => {
  it("When Defeated: 1 to each enemy ground unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(1, GUNGAN, true, 1).WithGroundUnitForPlayer(2, Cards.units.twi.hevy, true, 3).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([CSF]); // the damaged 2/2 died
    expect(g.state.player1.groundArena[0].damage).toBe(4 + 1); // Hevy's 4 in combat, then 1
  });
});
