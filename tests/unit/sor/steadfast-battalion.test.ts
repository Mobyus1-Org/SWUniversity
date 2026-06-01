import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_116 Steadfast Battalion (General Grievous) — 6/6 Ground (Villainy), cost 6
// "Overwhelm. On Attack: If you control a leader unit, give a friendly unit +2/+2 for this phase."

describe("SOR_116 Steadfast Battalion", () => {
  it("prompts to give +2/+2 when a leader unit is deployed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.steadfastBattalion)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // buff target
      .Build();
    g.loadNewState(state);

    state.player1.leader.deployed = true;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // On Attack fires: prompt to give +2/+2
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("gives +2/+2 to chosen friendly unit for this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.steadfastBattalion)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    state.player1.leader.deployed = true;

    const marinePlayId = state.player1.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine).toBeDefined();
    expect(g.state.currentEffects.some(e => e.cardId === "SOR_116" && e.targetPlayId === marinePlayId)).toBe(true);
  });

  it("does not fire when no leader unit is deployed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.steadfastBattalion)
      .Build();
    g.loadNewState(state);

    // Leader NOT deployed (not a unit)
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
