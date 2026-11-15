import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE } = F;

// TWI_198 Enfys Nest — Champion of Justice (5/7): "Saboteur" / "When Played/On Attack: You may return an enemy
// non-leader unit with less power than this unit to its owner's hand."
describe("TWI_198 Enfys Nest", () => {
  it("When Played: returns a weaker enemy unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, Cards.units.twi.enfysNestChampion).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
  });
});
