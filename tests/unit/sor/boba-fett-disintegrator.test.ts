import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_179 Boba Fett (Disintegrator) — 3/5 Ground (Cunning/Villainy), cost 3
// "On Attack: If this unit is attacking an exhausted unit that didn't enter play this round, deal 3 damage to the defender."

describe("SOR_179 Boba Fett", () => {
  it("deals 3 extra damage when attacking an exhausted unit that didn't enter play this round", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.bobaFettDisintegrator)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9
      .Build();
    g.loadNewState(state);
    // Pre-exhaust the defender (simulates it attacked last turn)
    state.player2.groundArena[0].ready = false;
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    // Normal 3 power + 3 on-attack bonus = 6 damage total
    expect(g.state.player2.groundArena[0].damage).toBe(6);
  });

  it("does not deal bonus damage when attacking a ready unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.bobaFettDisintegrator)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    // Only normal 3 power
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("does not deal bonus damage when attacking an exhausted unit that entered play this round", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.bobaFettDisintegrator)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    const defender = state.player2.groundArena[0];
    // Mark exhausted but entered play this round
    defender.ready = false;
    state.roundState.cardsEnteredPlayThisPhase.push({
      fromPlayer: 2,
      cardId: defender.cardId,
      playId: defender.playId,
      reason: "played",
    });

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defender.playId] });

    // Only normal 3 power
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });
});
