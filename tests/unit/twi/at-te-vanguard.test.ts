import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token

// TWI_247 AT-TE Vanguard (6/9): "Restore 3" / "When Defeated: Create 2 Clone Trooper tokens."
describe("TWI_247 AT-TE Vanguard", () => {
  it("When Defeated: 2 Clone Troopers", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, Cards.units.twi.atteVanguard, true, 8).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena.filter(u => u.cardId === CLONE).length).toBe(2);
  });
});
