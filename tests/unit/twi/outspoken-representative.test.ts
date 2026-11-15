import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token

// TWI_043 Outspoken Representative (0/3): Sentinel with another Republic unit / "When Defeated: Create a Clone Trooper token."
describe("TWI_043 Outspoken Representative", () => {
  it("When Defeated: a Clone Trooper", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, Cards.units.twi.outspokenRepresentative).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CLONE]);
  });
});
