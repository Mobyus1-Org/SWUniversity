import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING, power } = F;
const PAD = Cards.upgrades.hmw.landingPad;

// HMW_271 Landing Pad: "Fortify. Attached base gains: 'Friendly space units get +1/+0.'"
describe("HMW_271 Landing Pad", () => {
  it("friendly space units get +1/+0; ground and enemy units don't", () => {
    const g = load(board().WithUpgradesOnBaseForPlayer(1, [F.up(PAD, 1)]).WithSpaceUnitForPlayer(1, XWING).WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(2, XWING).Build());
    expect(power(g.state.player1.spaceArena[0])).toBe(3);
    expect(power(g.state.player1.groundArena[0])).toBe(3);
    expect(power(g.state.player2.spaceArena[0])).toBe(2);
  });
});
