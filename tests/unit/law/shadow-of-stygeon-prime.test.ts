import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_077 Shadow of Stygeon Prime (Condition upgrade, cost 4)
//   "Attach to a non-leader unit.
//    Attached unit can't ready. It gains: 'When the regroup phase starts: Deal 2 damage to your base.'"
//
// Two clauses on top of the attach restriction. Note "YOUR base" is read from the ATTACHED
// UNIT'S controller — this is played onto an ENEMY unit, so the damage hits the opponent, not
// the player who played the Condition.

const MARINE = Cards.units.sor.battlefieldMarine;
const SHADOW = Cards.upgrades.law.shadowOfStygeonPrime;

async function passToRegroup(g: GameTestAdapter) {
  await g.dispatchAsync(1, "pass-action", {});
  await g.dispatchAsync(2, "pass-action", {});
}

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 16)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(2, MARINE)
    .WithCardInDeckForPlayer(2, MARINE);
}

describe("LAW_077 Shadow of Stygeon Prime", () => {
  it("deals 2 damage to the ATTACHED UNIT'S controller's base at regroup", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE) // an ENEMY unit carries it
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHADOW, 1, 1)])
        .Build(),
    );

    await passToRegroup(g);

    expect(g.state.player2.base.damage).toBe(2); // the host's controller pays
    expect(g.state.player1.base.damage).toBe(0); // not the player who played it
  });

  it("stops the attached unit from readying in the regroup ready step", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        // Exhausted, and carrying the Condition — it must stay exhausted.
        .WithGroundUnitForPlayer(2, MARINE, false)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHADOW, 1, 1)])
        // A control unit with no Condition, also exhausted — it SHOULD ready.
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, false)
        .Build(),
    );

    await passToRegroup(g);
    // Regroup: resource step then ready step.
    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    const shadowed = g.state.player2.groundArena.find(u => u.upgrades.some(x => x.cardId === SHADOW))!;
    const control = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce)!;
    expect(shadowed.ready).toBe(false); // can't ready
    expect(control.ready).toBe(true);   // proves the ready step ran at all
  });

  it("cannot be attached to a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .MyLeader(Cards.leaders.sor.sabineWren, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.sabineWren) // deployed leader unit
        .WithGroundUnitForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, SHADOW)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    const leaderUnit = g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.sor.sabineWren)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderUnit.playId] });
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);

    // A non-leader unit is a legal host.
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine.playId] });
    expect(marine.playId).toBeDefined();
    expect(g.state.player1.groundArena.some(u => u.upgrades.some(x => x.cardId === SHADOW))).toBe(true);
  });

  it("does nothing at regroup when no unit carries it (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await passToRegroup(g);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(0);
  });
});
