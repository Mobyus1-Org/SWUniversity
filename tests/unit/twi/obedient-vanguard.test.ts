import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, CSF } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token

// TWI_104 Obedient Vanguard (1/1): "Raid 1" / "When Defeated: You may give a Trooper unit +2/+2 for this phase."
describe("TWI_104 Obedient Vanguard", () => {
  it("When Defeated: a Trooper gets +2/+2", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, Cards.units.twi.obedientVanguard).WithGroundUnitForPlayer(2, CLONE).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(2);
    await pick(g, [g.state.player2.groundArena[0].playId], 2);
    expect(F.power(g.state.player2.groundArena[0])).toBe(4);
  });
});
