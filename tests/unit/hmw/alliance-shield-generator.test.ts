import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_081 Alliance Shield Generator (Upgrade, cost 2, Vigilance/Heroism, Fortification) —
//   "Fortify (Attach this to your base, not a unit.)
//    If attached base would be dealt 5 or more damage, prevent that damage. If you do, defeat
//    this upgrade and draw a card."
//
// A single-use damage replacement: the whole instance is prevented, not the excess, and the
// threshold is on ONE instance of damage rather than a running total.

const SHIELD_GEN = Cards.upgrades.hmw.allianceShieldGenerator;
const MARINE = Cards.units.sor.battlefieldMarine;   // 3 power
const BIG = Cards.units.twi.tranquility;            // 7 power, Space

function setup(withShield = true) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithActivePlayer(2); // P2 attacks into P1's base
  if (withShield) {
    b = b.WithUpgradesOnBaseForPlayer(1, [
      { cardId: SHIELD_GEN, playId: "@", owner: 1, controller: 1 },
    ]);
  }
  return b;
}

describe("HMW_081 Alliance Shield Generator", () => {
  it("prevents a 5+ damage hit, then defeats itself and draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, BIG).Build());
    const handBefore = g.state.player1.hand.length;

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1); // 7 damage at P1's base

    expect(g.state.player1.base.damage).toBe(0);              // prevented outright
    expect(g.state.player1.base.upgrades ?? []).toHaveLength(0); // defeated itself
    expect(g.state.player1.hand.length).toBe(handBefore + 1);  // drew a card
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(SHIELD_GEN);
  });

  it("lets a hit of 4 or less through and stays attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1); // only 3 damage

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player1.base.upgrades).toHaveLength(1); // still there
    expect(g.state.player1.hand.length).toBe(handBefore);  // no draw
  });

  it("control: without it, the same 7 damage lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(false).WithSpaceUnitForPlayer(2, BIG).Build());

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.base.damage).toBe(7);
  });

  it("only guards the base it is attached to", async () => {
    const g = new GameTestAdapter();
    // P1 holds the shield; P2's base takes the big hit and is unprotected.
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, BIG)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(7);
    expect(g.state.player1.base.upgrades).toHaveLength(1); // untouched
  });

  it("is spent by the first big hit, so a second one lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(2, BIG)
        .WithSpaceUnitForPlayer(2, BIG)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);
    expect(g.state.player1.base.damage).toBe(0);

    await g.dispatchAsync(1, "pass-action", {});
    await g.attackWithSpaceUnitAsync(2, 1);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.base.damage).toBe(7); // nothing left to prevent it
  });
});
