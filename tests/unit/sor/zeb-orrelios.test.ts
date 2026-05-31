import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_146 Zeb Orrelios — 5/5 Ground (Heroism), cost 5
// "When this unit completes an attack: If the defender was defeated, you may deal 4 damage to a ground unit."

describe("SOR_146 Zeb Orrelios", () => {
  it("offers damage prompt when Zeb defeats the defender", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.zebOrrelios)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("deals 4 damage to chosen ground unit when yes is selected", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.zebOrrelios)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // defeated by Zeb
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // damage target
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;
    const damageTargetPlayId = state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [damageTargetPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("no prompt when Zeb attacks but defender survives", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.zebOrrelios)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 9 HP, survives Zeb's 5 power
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("skips damage when player declines", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.zebOrrelios)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
