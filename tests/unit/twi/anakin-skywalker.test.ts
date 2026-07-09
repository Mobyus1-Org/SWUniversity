import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_012 Anakin Skywalker — leader, "What it Takes to Win"
// Front: "Action [Exhaust, deal 2 damage to your base]: Attack with a unit. If it's
//         attacking a unit, it gets +2/+0 for this attack.
//         Epic Action: If you control 6 or more resources, deploy this leader."
// Back (deployed 4/7): "Overwhelm. This unit gets +1/+0 for every 5 damage on your base."

const ANAKIN = Cards.leaders.twi.anakinSkywalker;

describe("TWI_012 Anakin Skywalker — deployed leader unit (back)", () => {
  it("gets +1/+0 for every 5 damage on your base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 27)
      .MyLeader(ANAKIN, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, ANAKIN)
      .Build();
    g.loadNewState(state);

    const anakin = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(anakin.CurrentPower()).toBe(9); // 4 + floor(27/5)=5
    expect(anakin.CurrentHP()).toBe(7);    // HP unaffected
  });

  it("gets no buff below 5 base damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 4)
      .MyLeader(ANAKIN, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, ANAKIN)
      .Build();
    g.loadNewState(state);

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(4);
  });

  it("has Overwhelm — excess combat damage spills to the enemy base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 0) // no base-damage buff, keep power at 7
      .MyLeader(ANAKIN, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, ANAKIN)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.base.damage).toBe(1); // 4 power - 3 hp = 1 excess
  });
});

describe("TWI_012 Anakin Skywalker — leader Action (front)", () => {
  it("deals 2 to your base, then attacks with a unit; +2/+0 when attacking a unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 0)
      .MyLeader(ANAKIN) // ready, undeployed
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper) // attacker, 2/2 ready
      .WithGroundUnitForPlayer(2, Cards.units.sor.zebOrrelios)     // defender, 5/5 (survives)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);       // pay: exhaust + deal 2 to your base
    await g.chooseGroundUnitAsync(1, 0);    // attack with the Clone Trooper token
    await g.chooseGroundUnitAsync(2, 0);    // ...attacking Zeb (a unit)

    expect(g.state.player1.base.damage).toBe(2); // the "deal 2 to your base" cost
    const zeb = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.zebOrrelios)!;
    expect(zeb.damage).toBe(4); // token power 2 + 2 (attacking a unit)
    expect(g.state.player1.leader.ready).toBe(false); // leader exhausted
  });

  it("gives no +2/+0 when the attack is against a base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 0)
      .MyLeader(ANAKIN)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);                       // attack with the marine
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"], targetPlayers: [2] });

    expect(g.state.player1.base.damage).toBe(2);  // cost
    expect(g.state.player2.base.damage).toBe(3);  // marine power 3, no +2 vs a base
  });
});

describe("TWI_012 Anakin Skywalker — Epic Action deploy (front)", () => {
  it("deploys when you control 6 or more resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(ANAKIN)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === ANAKIN)).toBe(true);
  });
});
