import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("LOF_213 The Legacy Run — When Defeated", () => {
  it("spreads 6 damage when defeated", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Legacy Run is a 3/3 space unit — attacking System Patrol Craft (4/3) defeats it
      .WithSpaceUnitForPlayer(1, Cards.units.lof.theLegacyRun)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      // Two ground units as spread damage targets
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const enemy0 = state.player2.groundArena[0].playId;
    const enemy1 = state.player2.groundArena[1].playId;

    // Legacy Run (3 power) attacks System Patrol Craft (4/3) — both die
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // When Defeated fires — spread 6 damage among enemy units
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: enemy0, damage: 3 },
        { playId: enemy1, damage: 3 },
      ],
    });

    // Battlefield Marines are 3/3 — 3 damage defeats them
    expect(g.state.player2.groundArena.find(u => u.playId === enemy0)).toBeUndefined();
    expect(g.state.player2.groundArena.find(u => u.playId === enemy1)).toBeUndefined();
  });
});
