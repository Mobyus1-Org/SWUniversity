import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_018 Quinlan Vos — Sticking to the Shadows (Leader)
// Front:  When you play a unit: You may exhaust this leader. If you do, deal 1 damage to an
//         enemy unit that costs the same as the played unit.
//         Epic Action: If you control 5 or more resources, deploy this leader.
// Deployed: When you play a unit: You may deal 1 damage to an enemy unit that costs the same
//           as or less than the played unit.

describe("TWI_018 Quinlan Vos — front side", () => {
  it("may exhaust the leader to deal 1 to an enemy unit of equal cost (accept)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.quinlanVos)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 played unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy, cost 2
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // exhaust the leader
    await g.chooseGroundUnitAsync(2, 0); // deal 1 to the equal-cost enemy

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("may decline — no damage, leader stays ready", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.quinlanVos)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("does not trigger when no enemy unit shares the played unit's cost", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.quinlanVos)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .WithGroundUnitForPlayer(2, Cards.units.sor.ardentSympathizer) // cost 3, not equal
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("Epic Action: deploys when you control 5 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.quinlanVos)
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
      .MyLeader(Cards.leaders.twi.quinlanVos)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("TWI_018 Quinlan Vos — deployed side", () => {
  it("When you play a unit: may deal 1 to an enemy unit that costs the same or less", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.quinlanVos)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.ardentSympathizer) // cost 3 played unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy cost 2 (<= 3)
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1; // deploying handed the turn to the opponent

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });
});
