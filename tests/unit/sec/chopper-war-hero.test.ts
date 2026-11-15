import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const CHOPPER = Cards.units.sec.chopper; // 4/1

// SEC_147 Chopper (War Hero): "When this unit deals combat damage to a base: Each player discards a card from their hand."
describe("SEC_147 Chopper (War Hero)", () => {
  it("each player discards a card", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CHOPPER).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, MARINE).Build());
    await F.attackBase(g);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(1);
  });

  it("a player with no cards skips their discard", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CHOPPER).WithCardInHandForPlayer(2, MARINE).Build());
    await F.attackBase(g);
    await g.chooseCardFromHandAsync(2, 0);
    expect(g.state.player2.hand).toHaveLength(0);
  });
});
