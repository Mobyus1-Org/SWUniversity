import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_173 Blood Sport (Event, cost 3, Aggression, Fringe) — "Deal 2 damage to each ground unit."
//
// Targetless and indiscriminate: both players' GROUND arenas, the caster's own units included.
// Space is untouched.
//
// The damage goes through DealDamageToUnit rather than a raw `damage +=`, so Shield tokens absorb
// it and the when-unit-takes-damage trigger fires — see the Shield case below, which is the one
// that fails if this is written as a bare loop over `u.damage`.

const BLOOD_SPORT = Cards.events.twi.bloodSport;
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground — dies to 2? no, survives at 2
const CLONE = Cards.units.twi.phaseIClonetrooper;   // 3/2 Ground — 2 damage is lethal
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7 Ground — comfortably survives
const TIE = Cards.units.sor.tieLnFighter;           // Space — must be untouched

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP) // Aggression — covers the event
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, BLOOD_SPORT)
    .WithActivePlayer(1);
}

describe("TWI_173 Blood Sport", () => {
  it("deals 2 to every ground unit on BOTH sides, including your own", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(2); // your own unit is not spared
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("leaves SPACE units untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CSF)
        .WithSpaceUnitForPlayer(1, TIE)
        .WithSpaceUnitForPlayer(2, TIE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player1.spaceArena[0].damage).toBe(0);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });

  it("defeats the units it finishes off, on both sides at once", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CLONE) // 3/2 — lethal
        .WithGroundUnitForPlayer(2, CLONE) // 3/2 — lethal
        .WithGroundUnitForPlayer(2, CSF)   // 3/7 — survives
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CSF]);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("a Shield absorbs it instead of the unit taking damage", async () => {
    // The discriminator between DealDamageToUnit and a raw `damage +=` loop: a raw loop would
    // put 2 damage on the unit and leave the Shield sitting there.
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.token.shield, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const defender = g.state.player2.groundArena[0];
    expect(defender.damage).toBe(0);        // absorbed
    expect(defender.upgrades).toHaveLength(0); // the Shield was spent
  });

  it("plays and fizzles harmlessly with no ground units in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, TIE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([BLOOD_SPORT]);
    expect(g.state.player1.spaceArena[0].damage).toBe(0);
  });
});
