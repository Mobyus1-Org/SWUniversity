import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, power, hp } = F;
const OVERPOWER = Cards.events.lof.overpower;

// LOF_126 Overpower: "Give a unit +3/+3 and Overwhelm for this phase."
describe("LOF_126 Overpower", () => {
  it("+3/+3 and Overwhelm", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, OVERPOWER).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect([power(g.state.player1.groundArena[0]), hp(g.state.player1.groundArena[0])]).toEqual([6, 6]);
    await g.dispatchAsync(2, "pass-action", {});
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.base.damage).toBe(10 + 3);
  });
});
