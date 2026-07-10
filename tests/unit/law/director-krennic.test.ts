import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_008 Director Krennic — Amidst My Achievement.
// Leader side:
//   "Action [Exhaust, defeat a friendly unit]: Create a Credit token.
//    Epic Action: If you control 7 or more resources, deploy this leader."
// Deployed unit side (9/4 Ground):
//   "When Deployed: Another friendly unit deals damage equal to its power to an enemy unit."
describe("LAW_008 Director Krennic — leader side", () => {
  it("Action: exhaust + defeat a friendly unit to create a Credit token", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.directorKrennic) // ready, undeployed
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const friendlyPlayId = state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] });

    expect(g.state.player1.supplemental.creditTokens).toBe(1);
    expect(g.state.player1.groundArena.length).toBe(0);   // friendly unit defeated as cost
    expect(g.state.player1.leader.ready).toBe(false);      // leader exhausted
  });

  it("Epic Action: deploys when you control 7 or more resources (without spending them)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.law.directorKrennic)).toBe(true);
    expect(g.state.player1.resources.length).toBe(7); // resources are controlled, not spent
  });

  it("Epic Action: cannot deploy with fewer than 7 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("LAW_008 Director Krennic — deployed side (When Deployed)", () => {
  it("another friendly unit deals damage equal to its power to a chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // SOR_095, power 3
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 9 HP survivor
      .Build();
    g.loadNewState(state);

    const friendlyPlayId = state.player1.groundArena[0].playId;
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.deployLeaderAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] }); // the "another" friendly unit
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("cannot pick Krennic himself — with no other friendly unit, no damage is dealt", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
