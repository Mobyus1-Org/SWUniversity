import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Leaders whose Action ability paid its cost and did nothing, and whose deployed On Attack never
// fired. Both sides are covered per leader.
//
// SOR_007 Grand Moff Tarkin — Action [1 resource, Exhaust]: Give an Experience token to an Imperial unit.
//                             Deployed On Attack: You may give an Experience token to ANOTHER Imperial unit.
// SOR_011 Grand Inquisitor  — Action [Exhaust]: Deal 2 damage to a friendly unit with 3 or less power and ready it.
//                             Deployed On Attack: You may deal 1 damage to ANOTHER such unit and ready it.
// SHD_004 Rey               — Action [1 resource, Exhaust]: Give an Experience token to a unit with 2 or less power.
//                             Deployed On Attack: the same, optional.
// SHD_003 Finn              — Action [Exhaust]: Defeat a friendly upgrade on a unit. If you do, Shield that unit.
//                             Deployed On Attack: the same, optional.

const XP = Cards.upgrades.token.experience;
const SHIELD = Cards.upgrades.token.shield;
const count = (u: { upgrades: Array<{ cardId: string }> }, id: string) =>
  u.upgrades.filter(x => x.cardId === id).length;

function setup(leader: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("SOR_007 Grand Moff Tarkin", () => {
  it("front: gives an Experience token to an Imperial unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // Imperial
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("front: soft-passes with no Imperial unit in play (cost still paid)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, not Imperial
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("deployed: may give an Experience token to ANOTHER Imperial unit, never himself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper)
        .Build(),
    );
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;

    const tarkinIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.leaders.sor.grandMoffTarkin);
    const tarkinPlayId = g.state.player1.groundArena[tarkinIdx].playId;

    await g.attackWithGroundUnitAsync(1, tarkinIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).not.toContain(tarkinPlayId); // "another"

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targets[0]] });
    const trooper = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.deathTrooper)!;
    expect(count(trooper, XP)).toBe(1);
  });
});

describe("SOR_011 Grand Inquisitor", () => {
  it("front: deals 2 damage to a friendly low-power unit and readies it", async () => {
    const g = new GameTestAdapter();
    const state = setup(Cards.leaders.sor.grandInquisitor)
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3 power, 7 HP
      .Build();
    state.player1.groundArena[0].ready = false;
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    const unit = g.state.player1.groundArena[0];
    expect(unit.damage).toBe(2);
    expect(unit.ready).toBe(true);
  });

  it("front: does not offer a friendly unit with more than 3 power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.grandInquisitor)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa) // 5 power
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3 power
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    const securityForce = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce)!;
    expect(targets).toEqual([securityForce.playId]);
  });

  it("deployed: deals only 1 damage, and not to himself", async () => {
    const g = new GameTestAdapter();
    const state = setup(Cards.leaders.sor.grandInquisitor)
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .Build();
    state.player1.groundArena[0].ready = false;
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;

    const inqIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.leaders.sor.grandInquisitor);
    const inqPlayId = g.state.player1.groundArena[inqIdx].playId;

    await g.attackWithGroundUnitAsync(1, inqIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).not.toContain(inqPlayId);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targets[0]] });
    const unit = g.state.player1.groundArena.find(u => u.playId === targets[0])!;
    expect(unit.damage).toBe(1);
    expect(unit.ready).toBe(true);
  });
});

describe("SHD_004 Rey", () => {
  it("front: gives an Experience token to a unit with 2 or less power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.rey)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power — ineligible
        .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer) // 1 power — eligible
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    const enforcer = g.state.player2.groundArena[0];
    expect(targets).toEqual([enforcer.playId]); // enemy units are legal; 3-power friendly is not

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enforcer.playId] });
    expect(count(g.state.player2.groundArena[0], XP)).toBe(1);
  });

  it("deployed: may decline the Experience token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.rey)
        .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer)
        .Build(),
    );
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;

    const reyIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.leaders.shd.rey);
    await g.attackWithGroundUnitAsync(1, reyIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    const enforcer = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.hylobonEnforcer)!;
    expect(count(enforcer, XP)).toBe(0);
  });
});

describe("SHD_003 Finn", () => {
  it("front: defeats a friendly upgrade and Shields the unit it was on", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.finn)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.sor.academyTraining, 1),
        ])
        .Build(),
    );

    const upgradePlayId = g.state.player1.groundArena[0].upgrades[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradePlayId] });

    const marine = g.state.player1.groundArena[0];
    expect(marine.upgrades.some(u => u.cardId === Cards.upgrades.sor.academyTraining)).toBe(false);
    expect(count(marine, SHIELD)).toBe(1);
  });

  it("front: soft-passes when there is no friendly upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.finn)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(count(g.state.player1.groundArena[0], SHIELD)).toBe(0);
  });

  it("front: does not offer an ENEMY upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.finn)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.sor.academyTraining, 1),
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.sor.academyTraining, 2),
        ])
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([g.state.player1.groundArena[0].upgrades[0].playId]);
  });
});
