import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_040 Avenger", () => {
  it("When Played: opponent chooses a non-leader unit they control to defeat", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 9)
      .WithCardInHandForPlayer(1, Cards.units.sor.avenger)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.spaceArena.length).toBe(1); // Avenger deployed
  });

  it("When Played: opponent cannot target their leader (leaders excluded)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 9)
      .WithCardInHandForPlayer(1, Cards.units.sor.avenger)
      .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // deployed leader
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const leaderPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    // Attempting to choose the leader should be rejected
    const result = await g.dispatchAsync(2, "choose-target", { targetPlayIds: [leaderPlayId] });
    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena.length).toBe(2); // both still alive
  });

  it("On Attack: opponent chooses a non-leader unit they control to defeat", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.avenger)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const attackTargetId = state.player2.spaceArena[0].playId;
    const sacrificePlayId = state.player2.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [attackTargetId] });
    // On Attack fires: opponent chooses a non-leader unit
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [sacrificePlayId] });

    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("When Played: does nothing when opponent has no non-leader units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 9)
      .WithCardInHandForPlayer(1, Cards.units.sor.avenger)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // No resolution needed — auto-resolved with no eligible targets
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.spaceArena.length).toBe(1); // Avenger still deployed
  });
});
