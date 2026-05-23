import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SHD_132 Choose Sides", () => {
  it("exchanges control of both chosen units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // P1 friendly
      .WithGroundUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)  // P2 enemy (space unit but placed ground for simplicity)
      .WithCardInHandForPlayer(1, Cards.events.shd.chooseSides)
      .Build();

    const friendlyPlayId = state.player1.groundArena[0].playId;
    const enemyPlayId = state.player2.groundArena[0].playId;

    g.loadNewState(state);
    await g.playCardFromHandAsync(1, 0);

    // Step 1: choose friendly unit
    await g.chooseGroundUnitAsync(1, 0);
    // Step 2: choose enemy unit
    await g.chooseGroundUnitAsync(2, 0);

    // Both units should have swapped sides
    expect(g.state.player1.groundArena.some(u => u.playId === enemyPlayId)).toBe(true);
    expect(g.state.player2.groundArena.some(u => u.playId === friendlyPlayId)).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.playId === friendlyPlayId)).toBe(false);
    expect(g.state.player2.groundArena.some(u => u.playId === enemyPlayId)).toBe(false);
  });

  it("swap is permanent — units stay under new control after regroup", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.shd.chooseSides)
      .Build();

    const friendlyPlayId = state.player1.groundArena[0].playId;
    const enemyPlayId = state.player2.groundArena[0].playId;

    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Advance to regroup
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    // Swap should persist after regroup
    expect(g.state.player1.groundArena.some(u => u.playId === enemyPlayId)).toBe(true);
    expect(g.state.player2.groundArena.some(u => u.playId === friendlyPlayId)).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.playId === friendlyPlayId)).toBe(false);
    expect(g.state.player2.groundArena.some(u => u.playId === enemyPlayId)).toBe(false);
  });

  it("does not offer leader units as valid targets", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.shd.chooseSides)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // Step 1: try to choose the deployed leader — should be rejected
    const leaderPlayId = g.state.player1.leader.deployedPlayId ?? "";
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
