import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_064 Scorch — Imperial Commando (3/5 Ground, cost 3, Vigilance/Villainy,
// Imperial/Clone/Trooper, unique) —
//   "On Attack: You may deal 1 damage to an upgraded unit."
//
// "An upgraded unit" is unqualified: either side's units are legal, and a token counts as an
// upgrade (Shield, Experience and Weakness are all upgrades), so the filter is simply
// "has anything attached" rather than "has a non-token upgrade".
//
// Optional, so with no upgraded unit on the board there must be no prompt at all — and the attack
// has to carry on either way.

const SCORCH = "HMW_064";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7, survives a counter
const EXPERIENCE = Cards.upgrades.token.experience;
const SHIELD = Cards.upgrades.token.shield;

/** WithUpgradesOnGroundUnitForPlayer takes CardInPlay[], and the 5th arg of the unit builder is
 *  `controller` — not upgrades. Attaching through the wrong one silently leaves the unit bare. */
const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, SCORCH)
    .WithActivePlayer(1);
}

async function scorchAttacksBase(g: GameTestAdapter) {
  const idx = g.state.player1.groundArena.findIndex(u => u.cardId === SCORCH);
  await g.attackWithGroundUnitAsync(1, idx);
  await g.chooseBaseAsync(1, 2);
}

describe("HMW_064 Scorch — Imperial Commando", () => {
  it("deals 1 damage to a chosen upgraded ENEMY unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(EXPERIENCE, 2)])
        .Build(),
    );

    await scorchAttacksBase(g);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(3); // the attack still resolved
  });

  it("can target your OWN upgraded unit — 'an upgraded unit' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CSF)
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [up(EXPERIENCE, 1)]) // index 1 — Scorch is 0
        .Build(),
    );

    await scorchAttacksBase(g);
    await g.chooseYesAsync(1);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
    await g.chooseGroundUnitAsync(1, idx);

    expect(g.state.player1.groundArena[idx].damage).toBe(1);
  });

  it("a SHIELD token counts as an upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(SHIELD, 2)])
        .Build(),
    );

    await scorchAttacksBase(g);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    // The Shield absorbs the point of damage rather than the unit taking it — but the unit was a
    // legal target, which is what this test is pinning.
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("is optional — declining leaves everything alone and the attack still lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(EXPERIENCE, 2)])
        .Build(),
    );

    await scorchAttacksBase(g);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("gives no prompt when nothing on the board is upgraded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await scorchAttacksBase(g);

    // No pending prompt: an un-upgraded board is not a choice.
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("can finish off a 1-HP upgraded unit, and the body is swept", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(EXPERIENCE, 2)])
        .Build(),
    );
    // A 3/3 Marine with an Experience token is 4/4; at 3 damage one more point is lethal.
    g.state.player2.groundArena[0].damage = 3;

    await scorchAttacksBase(g);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("does not fire for a different attacker", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(EXPERIENCE, 2)])
        .Build(),
    );

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
