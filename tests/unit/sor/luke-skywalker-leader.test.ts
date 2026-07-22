import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_005 Luke Skywalker — Faithful Friend (Leader)
// Front:    Action [1 resource, exhaust]: Give a Shield token to a Heroism unit you played this phase.
//           Epic Action: If you control 6 or more resources, deploy this leader.
// Deployed: On Attack: You may give another unit a Shield token.

const SHIELD = Cards.upgrades.token.shield;

function shieldsOn(unit: { upgrades: Array<{ cardId: string }> }) {
  return unit.upgrades.filter(u => u.cardId === SHIELD).length;
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("SOR_005 Luke Skywalker — front side Action", () => {
  it("gives a Shield token to a Heroism unit played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        // Battlefield Marine is Heroism — played this phase below, so it becomes eligible.
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(shieldsOn(g.state.player1.groundArena[0])).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false); // exhausted as part of the cost
  });

  it("costs 1 resource on top of exhausting the leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore - 1);
  });

  it("does NOT offer a unit that was already in play (not played this phase)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // pre-existing, Heroism
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce) // played this phase
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await g.useLeaderAbilityAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    const playedThisPhase = g.state.player1.groundArena
      .find(u => u.cardId === Cards.units.sor.consularSecurityForce)!;
    expect(targets).toEqual([playedThisPhase.playId]);
  });

  it("does NOT offer a non-Heroism unit played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.shd.hylobonEnforcer) // Villainy — not Heroism
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await g.useLeaderAbilityAsync(1);

    // No legal target — the ability soft-passes rather than prompting.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(shieldsOn(g.state.player1.groundArena[0])).toBe(0);
  });

  it("does NOT offer an enemy Heroism unit played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.dispatchAsync(1, "pass-action", {});
    await g.playCardFromHandAsync(2, 0); // opponent plays a Heroism unit this phase
    await g.playCardFromHandAsync(1, 0); // we play ours

    await g.dispatchAsync(2, "pass-action", {});
    await g.useLeaderAbilityAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    const enemyPlayId = g.state.player2.groundArena[0].playId;
    expect(targets).not.toContain(enemyPlayId);
  });
});

describe("SOR_005 Luke Skywalker — deployed side On Attack", () => {
  it("may give ANOTHER unit a Shield token when attacking", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1); // Epic Action: flip him into the ground arena, ready
    g.state.activePlayer = 1;

    const lukeIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.leaders.sor.lukeSkywalker);
    const friendlyPlayId = g.state.player1.groundArena
      .find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.playId;

    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);

    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === friendlyPlayId)!;
    expect(shieldsOn(marine)).toBe(1);
  });

  it("may decline the Shield", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1); // Epic Action: flip him into the ground arena, ready
    g.state.activePlayer = 1;

    const lukeIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.leaders.sor.lukeSkywalker);
    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);

    await g.chooseNoAsync(1);

    expect(shieldsOn(g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!)).toBe(0);
  });

  it("cannot target Luke himself — 'another unit'", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1); // Epic Action: flip him into the ground arena, ready
    g.state.activePlayer = 1;

    const lukeIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.leaders.sor.lukeSkywalker);
    const lukePlayId = g.state.player1.groundArena[lukeIdx].playId;

    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).not.toContain(lukePlayId);
    expect(targets.length).toBeGreaterThan(0);
  });

  it("may give the Shield to an ENEMY unit ('another unit' is not restricted to friendlies)", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1); // Epic Action: flip him into the ground arena, ready
    g.state.activePlayer = 1;

    const lukeIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.leaders.sor.lukeSkywalker);
    const enemyPlayId = g.state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toContain(enemyPlayId);
  });
});
