import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING } = F;

// TWI_148 Senatorial Corvette (5/4 Space): "Saboteur" / "When Defeated: Each opponent discards a card from their hand."
describe("TWI_148 Senatorial Corvette", () => {
  it("When Defeated: the opponent discards a card", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.twi.senatorialCorvette, true, 3).WithSpaceUnitForPlayer(2, XWING).WithCardInHandForPlayer(2, MARINE).Build());
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    await g.chooseCardFromHandAsync(2, 0);
    expect(g.state.player2.hand.length).toBe(0);
  });
});
