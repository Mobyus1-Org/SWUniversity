import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_006 Colonel Yularen — leader "This Is Why We Plan".
// Front — Action [Exhaust]: Attack with a unit. Then, you may attack with another unit that costs less than it.
//         Epic Action: If you control 5 or more resources, deploy this leader.
// Back (deployed, 4/6 Ground) — When this unit completes an attack (and survives):
//         You may attack with another unit that costs 4 or less.
//
// Test-unit costs (cardCost map): SpecForce Soldier=1, Battlefield Marine=2, General Dodonna=4, Steadfast Battalion=5.

describe("SEC_006 Colonel Yularen — front Action", () => {
  it("attacks with a unit, then optionally attacks with a cheaper unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.colonelYularen)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // [0] cost 2, power 3
      .WithGroundUnitForPlayer(1, Cards.units.sor.specForceSoldier)   // [1] cost 1, power 2
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // marine attacks
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);            // yes, attack again
    await g.chooseGroundUnitAsync(1, 1); // specForce (cost 1 < 2) attacks
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player1.groundArena[1].ready).toBe(false);
    expect(g.state.player2.base.damage).toBe(5); // 3 + 2
  });

  it("does not offer a second attack when no other unit costs strictly less", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.colonelYularen)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // [0] cost 2
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // [1] cost 2 (not < 2)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[1].ready).toBe(true); // never attacked
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("declining the second attack leaves the cheaper unit ready", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.colonelYularen)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // [0] cost 2
      .WithGroundUnitForPlayer(1, Cards.units.sor.specForceSoldier)   // [1] cost 1
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player1.groundArena[1].ready).toBe(true);
    expect(g.state.player2.base.damage).toBe(3);
  });
});

describe("SEC_006 Colonel Yularen — Epic Action deploy", () => {
  it("deploys the leader for free when controlling 5+ resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.colonelYularen)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.resources.length).toBe(5); // free — nothing spent
  });

  it("cannot deploy the leader with fewer than 5 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.colonelYularen)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("SEC_006 Colonel Yularen — deployed (back side)", () => {
  it("after completing an attack, may attack with another unit costing 4 or less", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.colonelYularen, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sec.colonelYularen) // [0] deployed leader unit, power 4
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalDodonna)   // [1] cost 4, power 4
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0); // Yularen attacks base
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1);     // Dodonna (cost 4) attacks
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena[1].ready).toBe(false);
    expect(g.state.player2.base.damage).toBe(8); // 4 + 4
  });

  it("does not offer a follow-up attack when the only other unit costs more than 4", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.colonelYularen, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sec.colonelYularen)     // [0] deployed leader unit
      .WithGroundUnitForPlayer(1, Cards.units.sor.steadfastBattalion)   // [1] cost 5 (> 4)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[1].ready).toBe(true);
  });

  it("does not trigger when Yularen does not survive the attack", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sec.colonelYularen, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sec.colonelYularen, true, 5) // [0] pre-damaged 5 of 6 HP
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalDodonna)            // [1] cost 4
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)         // enemy, power 3 (kills Yularen)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Yularen attacks the marine and dies to the counter

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.sec.colonelYularen)).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
