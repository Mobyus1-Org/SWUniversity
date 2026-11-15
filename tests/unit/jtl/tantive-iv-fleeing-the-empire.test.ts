import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XWING } = F;
const TANTIVE = Cards.units.jtl.tantiveIV;

// JTL_252 Tantive IV: "When Played: Create an X-Wing token."
describe("JTL_252 Tantive IV", () => {
  it("When Played: creates an X-Wing", async () => {
    const g = load(board().WithCardInHandForPlayer(1, TANTIVE).Build());
    await F.playFromHand(g);
    expect(g.state.player1.spaceArena.filter(u => u.cardId === XWING)).toHaveLength(1);
  });
});
