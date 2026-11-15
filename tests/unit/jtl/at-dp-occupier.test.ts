import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const ATDP = Cards.units.jtl.atDPOccupier; // cost 4, Aggression
const spent = (g: ReturnType<typeof load>) => g.state.player1.resources.filter(r => !r.ready).length;

// JTL_163 AT-DP Occupier: "This unit costs 1 resource less to play for each damaged ground unit."
describe("JTL_163 AT-DP Occupier", () => {
  it("1 less per damaged ground unit (either side)", async () => {
    const g = load(board(Cards.leaders.sor.sabineWren).WithGroundUnitForPlayer(1, MARINE, true, 1).WithGroundUnitForPlayer(2, MARINE, true, 1).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, ATDP).Build());
    await F.playFromHand(g);
    expect(spent(g)).toBe(4 - 2);
  });

  it("damaged space units do not count", async () => {
    const g = load(board(Cards.leaders.sor.sabineWren).WithSpaceUnitForPlayer(2, F.XWING, true, 1).WithCardInHandForPlayer(1, ATDP).Build());
    await F.playFromHand(g);
    expect(spent(g)).toBe(4);
  });
});
