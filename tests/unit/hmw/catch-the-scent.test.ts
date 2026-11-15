import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const SCENT = Cards.events.hmw.catchTheScent;
const BEAST = Cards.units.token.beast;

// HMW_195 Catch the Scent: "Create 2 Beast tokens and ready 1 of them."
describe("HMW_195 Catch the Scent", () => {
  it("two Beasts, one of them ready", async () => {
    const g = load(board(Cards.leaders.sor.sabineWren).WithCardInHandForPlayer(1, SCENT).Build());
    await F.playFromHand(g);
    const beasts = g.state.player1.groundArena.filter(u => u.cardId === BEAST);
    expect(beasts).toHaveLength(2);
    expect(beasts.filter(b => b.ready)).toHaveLength(1);
  });
});
