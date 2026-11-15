import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE } = F;

// TWI_216 Fives (5/5): "Saboteur" / "When you play an event: You may put a Clone unit from your discard pile on the bottom of your deck. If you do, draw a card."
describe("TWI_216 Fives", () => {
  it("playing an event: recycles a Clone and draws", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.fives).WithCardInDiscardForPlayer(1, Cards.units.twi.jesse).WithCardInDeckForPlayer(1, MARINE)
      .WithCardInHandForPlayer(1, Cards.events.shd.smugglersAid).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.discard.find(c => c.cardId === Cards.units.twi.jesse)!.playId]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([Cards.units.twi.jesse]);
  });
});
