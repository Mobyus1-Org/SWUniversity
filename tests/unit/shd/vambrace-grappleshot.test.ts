import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, up, MARINE, CSF } from "./scan-fixtures";

// SHD_074 Vambrace Grappleshot (+2/+2, non-Vehicle): "Attached unit gains: 'On Attack: Exhaust the defender.'"
describe("SHD_074 Vambrace Grappleshot", () => {
  it("the attached unit exhausts the defender", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [up(Cards.upgrades.shd.vambraceGrappleshot, 1)]).WithGroundUnitForPlayer(2, CSF).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
});
