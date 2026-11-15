import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, XP } = F;
const GHOST = Cards.units.jtl.theGhost;
const CHOPPER = Cards.units.sor.chopper; // Spectre

// JTL_053 The Ghost: "Each other friendly Spectre unit gains this unit's keywords. While this unit is
// upgraded, it gains Sentinel."
describe("JTL_053 The Ghost", () => {
  it("while upgraded it has Sentinel, and so does another friendly Spectre unit", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, GHOST).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(XP, 1)]).WithGroundUnitForPlayer(1, CHOPPER).Build());
    const ghost = g.state.player1.spaceArena[0], chopper = g.state.player1.groundArena[0];
    expect(HasKeyword(ghost.cardId, "Sentinel", ghost.playId, 1)).toBe(true);
    expect(HasKeyword(chopper.cardId, "Sentinel", chopper.playId, 1)).toBe(true);
  });

  it("without an upgrade, neither has Sentinel", () => {
    const g = load(board().WithSpaceUnitForPlayer(1, GHOST).WithGroundUnitForPlayer(1, CHOPPER).Build());
    const ghost = g.state.player1.spaceArena[0], chopper = g.state.player1.groundArena[0];
    expect(HasKeyword(ghost.cardId, "Sentinel", ghost.playId, 1)).toBe(false);
    expect(HasKeyword(chopper.cardId, "Sentinel", chopper.playId, 1)).toBe(false);
  });
});
