import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const HOWL = Cards.events.hmw.howl;
const BEAST = Cards.units.token.beast;

// HMW_241 Howl: "Create a Beast token. You may return a non-leader unit to its owner's hand."
describe("HMW_241 Howl", () => {
  it("a Beast, and a unit back to its owner's hand", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, HOWL).Build());
    await F.playFromHand(g);
    expect(g.state.player1.groundArena.filter(u => u.cardId === BEAST)).toHaveLength(1);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("declining the return keeps the Beast", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, HOWL).Build());
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena.filter(u => u.cardId === BEAST)).toHaveLength(1);
  });
});
