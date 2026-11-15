import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF } = F;
const DROID = Cards.units.token.battleDroid;    // 1/1 Separatist Droid token

// TWI_235 Battle Droid Legion (6/5): "Exploit 2" / "When Defeated: Create 3 Battle Droid tokens."
describe("TWI_235 Battle Droid Legion", () => {
  it("When Defeated: 3 Battle Droids", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, Cards.units.twi.battleDroidLegion, true, 4).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena.filter(u => u.cardId === DROID).length).toBe(3);
  });
});
