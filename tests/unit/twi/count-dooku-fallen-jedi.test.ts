import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE, CSF, GUNGAN } = F;

// TWI_138 Count Dooku — Fallen Jedi (6/6): "Exploit 2" / "When Played: For each unit you exploited while
// playing this card, you may deal damage to an enemy unit equal to the power of the exploited unit."
describe("TWI_138 Count Dooku", () => {
  it("each exploited unit's power is dealt to an enemy unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, GUNGAN).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, CSF)
      .WithCardInHandForPlayer(1, Cards.units.twi.countDookuFallenJedi).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.exploitGroundUnitsAsync(1, [0, 1]);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[1].playId]);
    expect(g.state.player2.groundArena.map(u => u.damage).sort()).toEqual([2, 3]);
  });
});
