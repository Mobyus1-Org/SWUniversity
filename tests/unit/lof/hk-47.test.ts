import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_130 HK-47 (2/4 Ground) — "When an enemy unit is defeated: Deal 1 damage to its controller's base."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("LOF_130 HK-47", () => {
  it("deals 1 to the opponent's base when an enemy unit is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.hk47)                 // HK-47 in play
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards)  // 4 power attacker
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)    // the enemy that dies
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 1); // Honor Guards attacks the Marine
    await g.chooseGroundUnitAsync(2, 0);     // Marine (3 HP) defeated by 4 power

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(1); // HK-47 pinged the enemy base
  });

  it("does not fire when a FRIENDLY unit is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.hk47)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // friendly attacker that dies
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // 4 power kills it back
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseGroundUnitAsync(2, 0);

    // Our Marine died (friendly), so HK-47 must NOT damage the enemy base.
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
