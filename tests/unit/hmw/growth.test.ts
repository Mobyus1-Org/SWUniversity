import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const GROWTH = Cards.events.hmw.growth;
const BEAST = Cards.units.token.beast;

// HMW_272 Growth: "Create a Beast token. Heal 3 damage from your base. Draw a card."
describe("HMW_272 Growth", () => {
  it("a Beast, 3 healed from your base, and a card drawn", async () => {
    const g = load(board().WithCardInHandForPlayer(1, GROWTH).WithCardInDeckForPlayer(1, MARINE).Build());
    await F.playFromHand(g);
    expect(g.state.player1.groundArena.filter(u => u.cardId === BEAST)).toHaveLength(1);
    expect(g.state.player1.base.damage).toBe(7);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
  });
});
