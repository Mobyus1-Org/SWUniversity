import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardTitle } from "@/server/engine/card-db/generated";

// A unit with its OWN On Attack, wearing an upgrade that ALSO grants one, must fire BOTH.
//
// resolveOnAttackTrigger captured an interactive upgrade ability in `deferredPending` and then
// did `if (deferredPending) return deferredPending;` — returning BEFORE the loop over the
// attacker's own innate abilities, so the unit's trigger was dropped entirely. The ordering
// prompt that would otherwise sequence them is nested under `if (hasSab)`, so it only ever fires
// for a Saboteur attacker and never rescued this.
//
// Reported against TWI_203 Chancellor Palpatine + SEC_210 Stolen Starpath Unit (Spies appeared,
// his Clone Trooper did not), but it was engine-wide: ANY interactive upgrade On Attack silenced
// its host's own.

const CHANCELLOR = Cards.units.twi.wartimeChancellor;   // innate, auto-resolving
const BENTHIC = Cards.units.law.benthicTwoTubesLaw;        // innate, needs a target
const STARPATH = Cards.upgrades.sec.stolenStarpathUnit; // granted, needs input
const MARINE = Cards.units.sor.battlefieldMarine;
const BATTLE_DROID = Cards.units.token.battleDroid;
const CLONE_TROOPER = Cards.units.token.cloneTrooper;
const CLONE = Cards.units.twi.phaseIClonetrooper;
const CSF = Cards.units.sor.consularSecurityForce;

const countOf = (g: GameTestAdapter, cardId: string) =>
  g.state.player1.groundArena.filter(u => u.cardId === cardId).length;

function board(attacker: string, withUpgrade: boolean) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, attacker)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, BATTLE_DROID) // killed first, so "a unit left play this phase"
    .WithGroundUnitForPlayer(2, CSF)          // survives, a legal Benthic target
    .WithCardInHandForPlayer(2, CLONE)
    .WithActivePlayer(1);
  if (withUpgrade) {
    b = b.WithUpgradesOnGroundUnitForPlayer(1, 0, [
      { cardId: STARPATH, playId: "@", owner: 1, controller: 1 },
    ]);
  }
  return b;
}

/** Kills the enemy Battle Droid with the Marine, then hands the turn back to P1. */
async function primeAndPass(g: GameTestAdapter) {
  const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
  await g.attackWithGroundUnitAsync(1, marineIdx);
  await g.chooseGroundUnitAsync(2, 0);
  await g.dispatchAsync(2, "pass-action", {});
}

describe("On Attack: an upgrade's trigger must not swallow the attacker's own", () => {
  it("control: without the upgrade, the Chancellor's own On Attack fires", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(CHANCELLOR, false).Build());
    await primeAndPass(g);

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === CHANCELLOR);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseBaseAsync(1, 2);

    expect(countOf(g, CLONE_TROOPER)).toBe(1);
  });

  it("auto innate + interactive upgrade: BOTH fire", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(CHANCELLOR, true).Build());
    await primeAndPass(g);

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === CHANCELLOR);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(CLONE)] });
    await g.dispatchAsync(1, "choose-target", {}); // dismiss the reveal

    expect(countOf(g, Cards.units.token.spy)).toBe(1);      // the upgrade's
    expect(countOf(g, CLONE_TROOPER)).toBe(1);              // the unit's own
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("interactive innate + interactive upgrade: both prompts run, then combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(BENTHIC, true).Build());
    await primeAndPass(g);

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === BENTHIC);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseBaseAsync(1, 2);

    // Benthic's own target prompt comes first...
    const csfIdx = g.state.player2.groundArena.findIndex(u => u.cardId === CSF);
    await g.chooseGroundUnitAsync(2, csfIdx);
    expect(g.state.player2.groundArena.find(u => u.cardId === CSF)!.damage).toBe(1);

    // ...then the upgrade's naming prompt still runs.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(CLONE)] });
    await g.dispatchAsync(1, "choose-target", {});

    expect(countOf(g, Cards.units.token.spy)).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBeGreaterThan(0); // combat still happened
  });
});
