import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const INSTINCT = Cards.upgrades.hmw.huntersInstinct;
const TURTLE = Cards.units.ash.dinosaurTurtle; // Creature

// HMW_191 Hunter's Instinct: "If attached unit is a Creature, it gains Grit."
describe("HMW_191 Hunter's Instinct", () => {
  it("a Creature gains Grit", () => {
    const g = load(board().WithGroundUnitForPlayer(1, TURTLE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(INSTINCT, 1)]).Build());
    const u = g.state.player1.groundArena[0];
    expect(HasKeyword(u.cardId, "Grit", u.playId, 1)).toBe(true);
  });

  it("a non-Creature does not", () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(INSTINCT, 1)]).Build());
    const u = g.state.player1.groundArena[0];
    expect(HasKeyword(u.cardId, "Grit", u.playId, 1)).toBe(false);
  });
});
