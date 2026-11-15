import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, MARINE, CSF, GUNGAN } from "./scan-fixtures";

// SHD_138 Jango Fett — Renowned Bounty Hunter (3/6 Ground): "While attacking a unit with a Bounty, this
// unit gets +3/+0 and gains Overwhelm." / "When this unit attacks and defeats a unit: Draw a card."
describe("SHD_138 Jango Fett", () => {
  it("attacks and defeats: draws a card", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.jangoFettRenowned).WithGroundUnitForPlayer(2, GUNGAN).WithCardInDeckForPlayer(1, MARINE).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.hand.length).toBe(1);
  });
  it("no defeat: no draw", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.jangoFettRenowned).WithGroundUnitForPlayer(2, CSF).WithCardInDeckForPlayer(1, MARINE).Build());
    await attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.hand.length).toBe(0);
  });
});
