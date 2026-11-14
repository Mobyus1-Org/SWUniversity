import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// HMW_088 Numa — Still Fighting (4/4 Ground, cost 4, Vigilance) —
//   "Restore 1"
//   "If this unit would be dealt damage, prevent 1 of that damage."
//
// The prevention is per damage INSTANCE — combat damage both ways, and ability damage. It runs
// before Shield absorption, so a 1-damage hit is fully prevented and the Shield survives it.

const NUMA = Cards.units.hmw.numa;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const CSF = Cards.units.sor.consularSecurityForce; // 3/7
const OPEN_FIRE = Cards.events.sor.openFire;       // Deal 4 damage to a unit
const SHIELD = Cards.upgrades.token.shield;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

describe("HMW_088 Numa", () => {
  it("has Restore 1 — attacking heals 1 from your base", async () => {
    expect(RestoreAmount(NUMA)).toBe(1);
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, NUMA).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(4);
  });

  it("prevents 1 of the counter-damage when she attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, NUMA).WithGroundUnitForPlayer(2, CSF).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].damage).toBe(2); // 3 − 1
    expect(g.state.player2.groundArena[0].damage).toBe(4); // her own damage is not reduced
  });

  it("prevents 1 of combat damage when she defends", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, NUMA).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2); // 3 − 1
  });

  it("prevents 1 of ability damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .MyLeader(Cards.leaders.sor.sabineWren) // Aggression for Open Fire
        .FillResourcesForPlayer(1, MARINE, 14)
        .WithCardInHandForPlayer(1, OPEN_FIRE)
        .WithGroundUnitForPlayer(2, NUMA)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3); // 4 − 1
  });

  it("a 1-damage hit is fully prevented before the Shield is consulted, so the Shield survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, Cards.units.ibh.echoCoordinator) // 1 power → 0 after prevention
        .WithGroundUnitForPlayer(2, NUMA)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(SHIELD, 2)])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].upgrades.some(u => u.cardId === SHIELD)).toBe(true);
  });

  it("a 2-damage hit is reduced to 1, which the Shield then absorbs", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, Cards.units.hmw.grandArmyMarine) // 2 power
        .WithGroundUnitForPlayer(2, NUMA)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(SHIELD, 2)])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].upgrades.some(u => u.cardId === SHIELD)).toBe(false);
  });
});
