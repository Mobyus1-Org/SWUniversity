import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_009 Darth Maul — Sith Revealed (Ground leader)
// Leader:   "Action [Exhaust, use the Force (lose your Force token)]: Deal 1 damage to a unit and 1
//            damage to a different unit."
//           "Epic Action: If you control 6 or more resources, deploy this leader."
// Deployed: "On Attack: Deal 1 damage to a unit and 1 damage to a different unit."

describe("LOF_009 Darth Maul (leader) — Action: 1 damage to two different units", () => {
  it("deals 1 to each of two chosen units and spends the Force", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.darthMaul)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // [0]
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)   // [1]
      .WithActivePlayer(1)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    const first = state.player2.groundArena[0].playId;
    const second = state.player2.groundArena[1].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [first] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [second] });

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.groundArena[1].damage).toBe(1);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is unavailable without the Force", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.darthMaul)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state); // no Force token

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});

describe("LOF_009 Darth Maul — Epic Action deploy (6+ resources)", () => {
  it("deploys for free with 6 resources; not with 5", async () => {
    const g6 = new GameTestAdapter();
    g6.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.darthMaul)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithActivePlayer(1)
        .Build(),
    );
    await g6.deployLeaderAsync(1);
    expect(g6.state.player1.leader.deployed).toBe(true);

    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.darthMaul)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(false);
  });
});

describe("LOF_009 Darth Maul (deployed) — On Attack: 1 damage to two different units", () => {
  it("deals 1 to each of two chosen units on attack (no Force cost)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.darthMaul, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.lof.darthMaul)      // [0] deployed leader unit (attacker)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy [0]
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)   // enemy [1]
        .WithActivePlayer(1)
        .Build(),
    );

    const first = g.state.player2.groundArena[0].playId;
    const second = g.state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // Maul attacks the base
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [first] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [second] });

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.groundArena[1].damage).toBe(1);
  });
});
