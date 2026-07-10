import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_018 The Mandalorian — Sworn To The Creed (Leader)
// Front:  When you play an upgrade: You may exhaust this leader. If you do, exhaust an enemy
//         unit with 4 or less remaining HP.
//         Epic Action: If you control 6 or more resources, deploy this leader.
// Deployed: When you play an upgrade: You may exhaust an enemy unit with 6 or less remaining HP.

describe("SHD_018 The Mandalorian — front side", () => {
  function setup(enemyUnit = Cards.units.sor.battlefieldMarine, leaderReady = true) {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.theMandalorian, leaderReady)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // upgrade attach target
      .WithGroundUnitForPlayer(2, enemyUnit) // exhaust target (ready by default)
      .Build();
    g.loadNewState(state);
    return g;
  }

  it("may exhaust the leader to exhaust an enemy unit with 4 or less HP (accept)", async () => {
    const g = setup();

    await g.playCardFromHandAsync(1, 0); // play Academy Training
    await g.chooseGroundUnitAsync(1, 0); // attach to friendly Marine
    await g.chooseYesAsync(1); // exhaust the leader
    await g.chooseGroundUnitAsync(2, 0); // exhaust the enemy Marine (3 HP)

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("may decline — nothing exhausted, leader stays ready", async () => {
    const g = setup();

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("does not trigger when no enemy unit has 4 or less HP", async () => {
    const g = setup(Cards.units.law.scavengingSandcrawler); // 7 HP

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // attach the upgrade; no reaction should follow

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("Epic Action: deploys when you control 6 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.theMandalorian)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
  });

  it("Epic Action: does not deploy with fewer than 6 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.theMandalorian)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("SHD_018 The Mandalorian — deployed side", () => {
  it("When you play an upgrade: may exhaust an enemy unit with 6 or less HP (no leader cost)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.theMandalorian)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // attach target
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 HP ≤ 6
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1; // deploying handed the turn to the opponent

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // attach the upgrade to the friendly Marine
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // exhaust the enemy Gamorrean

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
});
