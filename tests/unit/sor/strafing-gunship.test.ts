import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_212 — Strafing Gunship (3/4 Space, Cunning, cost 4)
// "This unit can attack units in the ground arena.
// While this unit is attacking a ground unit, the defender gets –2/–0."

describe("SOR_212 — Strafing Gunship", () => {
  it("can attack enemy ground units from space arena", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.strafingGunship)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const groundUnitPlayId = state.player2.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);

    // The ground unit should be a valid target
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    expect((resolution as any)?.fromPlayIds).toContain(groundUnitPlayId);
  });

  it("defeats a ground unit with 2 or less HP (power 3 – 2 penalty = 1, but actually defender loses 2 power)", async () => {
    // Strafing Gunship is 3/4. It attacks a 2/2 ground unit.
    // Defender gets –2/+0, so defender has 0 effective power.
    // Strafing Gunship deals 3 damage to defender (2 HP), defeats it.
    // Defender deals 0 counter-damage (power reduced to 0).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.strafingGunship)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
      .Build();
    g.loadNewState(state);

    const groundUnitPlayId = state.player2.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [groundUnitPlayId] });

    // Marine (3/3) is defeated by 3 power. Strafing Gunship takes 0 counter-damage (3 - 2 = 1, but marine has 3 power base)
    // Actually: marine base power is 3, minus 2 = 1. Strafing Gunship takes 1 damage.
    expect(g.state.player2.groundArena).toHaveLength(0); // marine defeated
    const sg = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.strafingGunship);
    expect(sg?.damage).toBe(1); // reduced counter-damage (3 - 2 = 1)
  });

  it("does not reduce defender power when attacking space units", async () => {
    // TIE Advanced is 3/2 space. SG attacks in space — no power penalty applies.
    // SG deals 3 → kills TIE. TIE deals 3 counter-damage (full power, no penalty).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.strafingGunship)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.tieAdvanced) // 3/2 space unit
      .Build();
    g.loadNewState(state);

    const spaceUnitPlayId = state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [spaceUnitPlayId] });

    // TIE Advanced is 3/2. Defeated. SG takes full 3 counter-damage (no reduction for space).
    const sg = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.strafingGunship);
    expect(sg?.damage).toBe(3); // full 3 counter-damage, no –2 penalty
  });
});
