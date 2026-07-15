import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_015 Cal Kestis — I Can't Keep Hiding (Ground leader)
// Leader:   "Action [Exhaust, use the Force (lose your Force token)]: An opponent chooses a ready
//            unit they control. Exhaust that unit."
//           "Epic Action: If you control 4 or more resources, deploy this leader."
// Deployed: "On Attack: An opponent chooses a ready unit they control. Exhaust that unit."

describe("LOF_015 Cal Kestis (leader) — Action: exhaust an enemy ready unit", () => {
  it("exhausts a chosen enemy ready unit and spends the Force", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.calKestis)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // ready enemy unit
      .WithActivePlayer(1)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false); // exhausted
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is unavailable without the Force", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.calKestis)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .WithActivePlayer(1)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("LOF_015 Cal Kestis — Epic Action deploy (4+ resources)", () => {
  it("deploys for free with 4 resources; not with 3", async () => {
    const g4 = new GameTestAdapter();
    g4.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.calKestis)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithActivePlayer(1)
        .Build(),
    );
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(true);

    const g3 = new GameTestAdapter();
    g3.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.calKestis)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithActivePlayer(1)
        .Build(),
    );
    await g3.deployLeaderAsync(1);
    expect(g3.state.player1.leader.deployed).toBe(false);
  });
});

describe("LOF_015 Cal Kestis (deployed) — On Attack: exhaust an enemy ready unit", () => {
  it("exhausts a chosen enemy ready unit on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.calKestis, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.lof.calKestis) // [0] deployed leader unit (attacker)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // ready enemy
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);        // Cal attacks the base
    await g.chooseGroundUnitAsync(2, 0);  // opponent's ready unit is exhausted

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
});
