import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_133 Lost and Forgotten — "Defeat a non-leader unit. If you do, heal 3 damage from your base."

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5) // 5 damage to heal from
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.events.law.lostAndForgotten);
}

describe("LAW_133 Lost and Forgotten", () => {
  it("defeats a chosen non-leader unit and heals 3 from your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(2); // 5 - 3
  });

  it("defeats regardless of the unit's HP (it is a defeat, not damage)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(2);
  });

  it("can defeat a friendly unit ('a non-leader unit', either side)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(2);
  });

  it("does not offer a leader unit as a target ('non-leader unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // a leader unit in the arena
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const leaderPlayId = g.state.player2.groundArena.find(
      u => u.cardId === Cards.leaders.sor.sabineWren,
    )!.playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(2); // leader survives
    expect(g.state.player1.base.damage).toBe(5); // no defeat → no heal
  });

  it("does not heal when there is no unit to defeat ('if you do')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(5); // unchanged — nothing was defeated
  });

  it("never heals past 0 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP, 1)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.law.lostAndForgotten)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.base.damage).toBe(0);
  });
});
