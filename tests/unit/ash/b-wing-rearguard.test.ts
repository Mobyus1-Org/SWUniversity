import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { Cards } from "../../card-helpers";

// ASH_078 B-Wing Rearguard (3/5 Space) —
// "While you control a ground unit, this unit gains Sentinel."
function setup(withFriendlyGroundUnit: boolean, withEnemyGroundUnit = false) {
  let builder = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, Cards.units.ash.bWingRearguard);

  if (withFriendlyGroundUnit) {
    builder = builder.WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine);
  }
  if (withEnemyGroundUnit) {
    builder = builder.WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine);
  }

  const g = new GameTestAdapter();
  g.loadNewState(builder.Build());
  const rearguard = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.bWingRearguard)!;
  return { g, rearguard };
}

describe("ASH_078 B-Wing Rearguard", () => {
  it("gains Sentinel while you control a ground unit", () => {
    const { rearguard } = setup(true);
    expect(HasKeyword(Cards.units.ash.bWingRearguard, "Sentinel", rearguard.playId, 1)).toBe(true);
  });

  it("does not have Sentinel while you control no ground unit", () => {
    const { rearguard } = setup(false);
    expect(HasKeyword(Cards.units.ash.bWingRearguard, "Sentinel", rearguard.playId, 1)).toBe(false);
  });

  // "you control" — an enemy ground unit must not switch it on.
  it("does not count an enemy ground unit", () => {
    const { rearguard } = setup(false, true);
    expect(HasKeyword(Cards.units.ash.bWingRearguard, "Sentinel", rearguard.playId, 1)).toBe(false);
  });
});
