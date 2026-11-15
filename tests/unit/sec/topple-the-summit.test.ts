import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const TOPPLE = Cards.events.sec.toppleTheSummit;

// SEC_183 Topple the Summit: "Deal 3 damage to each damaged unit."
describe("SEC_183 Topple the Summit", () => {
  it("3 damage to each damaged unit (both sides), none to undamaged ones", async () => {
    const g = load(board(Cards.leaders.sor.sabineWren).WithGroundUnitForPlayer(2, MARINE, true, 1).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(1, CSF, true, 1).WithCardInHandForPlayer(1, TOPPLE).Build());
    await F.playFromHand(g);
    expect(g.state.player2.groundArena.map(u => [u.cardId, u.damage])).toEqual([[CSF, 0]]);
    expect(g.state.player1.groundArena[0].damage).toBe(4);
  });
});
