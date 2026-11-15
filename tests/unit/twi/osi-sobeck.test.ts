import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token

// TWI_115 Osi Sobeck (3/6, cost 6): "Exploit 3" / "When Played: This unit captures an enemy non-leader ground
// unit with cost equal to or less than the number of resources paid to play this unit."
describe("TWI_115 Osi Sobeck", () => {
  it("paid 6: captures an enemy Marine (cost 2)", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, Cards.units.twi.osiSobeck).Build());
    await F.playFromHand(g);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
  });
  it("paid 0 after exploiting 3: nothing it can capture", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, CLONE)
      .WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, Cards.units.twi.osiSobeck).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.exploitGroundUnitsAsync(1, [0, 1, 2]);
    expect(g.state.player2.groundArena.length).toBe(1);
  });
});
