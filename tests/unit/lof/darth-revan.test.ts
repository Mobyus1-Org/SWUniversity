import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { Cards } from "../../card-helpers";

// LOF_017 Darth Revan — Scourge of the Old Republic (Leader)
// Front:  When a friendly unit attacks and defeats a unit: You may exhaust this leader.
//         If you do, give an Experience token to that friendly unit.
//         Epic Action: If you control 5 or more resources, deploy this leader.
// Deployed: Restore 1. When a friendly unit attacks and defeats a unit: You may give an
//           Experience token to that friendly unit.

function hasXp(unit: { upgrades: { cardId: string }[] }): boolean {
  return unit.upgrades.some(u => u.cardId === Cards.upgrades.token.experience);
}

describe("LOF_017 Darth Revan — front side", () => {
  function attackAndDefeatSetup(leaderReady = true) {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.darthRevan, leaderReady)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // 4/4 attacker — survives, defeats the Marine
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 defender
      .Build();
    g.loadNewState(state);
    return g;
  }

  it("may exhaust the leader to give an Experience token to the attacker (accept)", async () => {
    const g = attackAndDefeatSetup();

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack & defeat the Marine
    await g.chooseYesAsync(1); // exhaust Darth Revan

    expect(hasXp(g.state.player1.groundArena[0])).toBe(true);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("may decline (no XP, leader stays ready)", async () => {
    const g = attackAndDefeatSetup();

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1); // decline

    expect(hasXp(g.state.player1.groundArena[0])).toBe(false);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("does not trigger when the leader is already exhausted", async () => {
    const g = attackAndDefeatSetup(false); // leader exhausted

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // No reaction offered — attack simply completes.
    expect(g.state.player2.groundArena).toHaveLength(0); // Marine defeated
    expect(hasXp(g.state.player1.groundArena[0])).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("Epic Action: deploys when you control 5 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.darthRevan)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
  });

  it("Epic Action: does not deploy with fewer than 5 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.darthRevan)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("LOF_017 Darth Revan — deployed side", () => {
  it("has Restore 1", () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.darthRevan)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .Build();
    g.loadNewState(state);

    expect(RestoreAmount(Cards.leaders.lof.darthRevan)).toBe(1);
  });

  it("When a friendly unit attacks and defeats a unit: may give it an Experience token (no exhaust)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.darthRevan)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // attacker
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // defender
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1; // deploying handed the turn to the opponent

    const gamorreanIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.sor.gamorreanGuards);
    await g.dispatchAsync(1, "initiate-attack", { playId: g.state.player1.groundArena[gamorreanIdx].playId });
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1); // give XP

    const gamorrean = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.gamorreanGuards)!;
    expect(hasXp(gamorrean)).toBe(true);
  });
});
