import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_088 Blizzard Assault AT-AT — 9/9 Ground (Command+Villainy)
// When this unit attacks and defeats a unit: You may deal the excess damage
// from this attack to an enemy ground unit.

describe("SOR_088 Blizzard Assault AT-AT", () => {
  it("offers excess damage option when defeating a unit with excess", async () => {
    // AT-AT has 9 power. Marine has 3 HP → 6 excess damage.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // second target
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player2.groundArena[0].playId;
    const secondMarinePlayId = state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // After defeating the marine, excess damage option should fire
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [secondMarinePlayId] });

    // Second marine took 6 excess damage (> 3 HP) → defeated
    expect(g.state.player2.groundArena.find(u => u.playId === secondMarinePlayId)).toBeUndefined();
  });

  it("no excess damage option when attack exactly defeats (no excess)", async () => {
    // AT-AT (9 power) vs 9 HP unit → exactly 0 excess
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt)
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt) // 9 HP — exactly absorbed
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    // No excess → no option
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
  });

  it("no excess damage option when defending unit is not defeated", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt) // survives 2 damage
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
  });

  it("player may decline the excess damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player2.groundArena[0].playId;
    const secondMarinePlayId = state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });
    await g.chooseNoAsync(1);

    // Second marine untouched
    const secondMarine = g.state.player2.groundArena.find(u => u.playId === secondMarinePlayId);
    expect(secondMarine?.damage).toBe(0);
  });
});
