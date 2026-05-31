import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_161 Ardent Sympathizer — 3/3 Ground (Aggression), cost 3
// "While you have the initiative, this unit gets +2/+0."

describe("SOR_161 Ardent Sympathizer", () => {
  it("deals 5 damage when its controller has the initiative", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.ardentSympathizer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9, survives either way
      .Build();
    g.loadNewState(state);
    state.initiativePlayer = 1;

    const defenderPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(5); // 3 base + 2 bonus
  });

  it("deals 3 damage when its controller does not have the initiative", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.ardentSympathizer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9, survives either way
      .Build();
    g.loadNewState(state);
    state.initiativePlayer = 2;

    const defenderPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3); // base power only
  });
});
