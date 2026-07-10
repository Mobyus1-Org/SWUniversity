import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { Cards } from "../../card-helpers";

// SHD_014 Cad Bane — He Who Fears (Leader)
// Front:  When you play an Underworld card: You may exhaust this leader. If you do, an opponent
//         chooses a unit they control. Deal 1 damage to it.
//         Epic Action: If you control 6 or more resources, deploy this leader.
// Deployed: Raid 2. When you play an Underworld card: You may choose an opponent. They choose a
//           unit they control. Deal 2 damage to it. Use this ability only once each round.

describe("SHD_014 Cad Bane — front side", () => {
  it("may exhaust the leader; then the opponent chooses their unit to take 1 damage (accept)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.shd.hylobonEnforcer) // Underworld, cost 1
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // the opponent's unit
      .Build();
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Cad Bane's controller chooses to exhaust him
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [enemyPlayId] }); // opponent chooses their unit

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("may decline — no damage, leader stays ready", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.shd.hylobonEnforcer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("does not trigger when the played card is not an Underworld card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel/Trooper, not Underworld
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("Epic Action: deploys when you control 6 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
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
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("SHD_014 Cad Bane — deployed side", () => {
  it("has Raid 2", () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .Build();
    g.loadNewState(state);

    expect(RaidAmount(Cards.leaders.shd.cadBane)).toBe(2);
  });

  it("When you play an Underworld card: opponent chooses their unit to take 2 damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
      .WithCardInHandForPlayer(1, Cards.units.shd.hylobonEnforcer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 HP, survives 2
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;

    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("can be used only once each round", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.shd.hylobonEnforcer)
      .WithCardInHandForPlayer(1, Cards.units.shd.hylobonEnforcer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;

    const enemyPlayId = state.player2.groundArena[0].playId;

    // First Underworld card — ability used, deals 2.
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [enemyPlayId] });
    expect(g.state.player2.groundArena[0].damage).toBe(2);

    // Second Underworld card the same round — ability already used, no reaction.
    g.state.activePlayer = 1;
    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
