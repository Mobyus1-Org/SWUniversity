import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";

// HMW_210 Sol — Compassionate Guardian (2/2 Ground, cost 2, Cunning/Heroism, Force/Jedi, unique) —
//   "Shielded (When you play this unit, give a Shield token to it.)"
//   "On Attack: This unit gains Sentinel for this phase."
//
// Both halves already exist in the engine: Shielded is a printed keyword, and the self-Sentinel
// On Attack is exactly ASH_099 Gozanti Assault Carrier — a Phase-duration effect keyed to the
// attacker's own playId, which sentinel.ts reads.
//
// "For this phase" is the part worth pinning: the grant must survive the rest of the phase and be
// gone afterwards, which a Phase-duration effect gets from the regroup cleanup.

const SOL = "HMW_210";
const SHIELD = Cards.upgrades.token.shield;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Cunning
    .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance/Heroism — covers Sol's Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

const sol = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === SOL)!;
const solHasSentinel = (g: GameTestAdapter) => {
  const u = sol(g);
  return HasSentinel(u.cardId, u.playId, 1) === true;
};

describe("HMW_210 Sol — Compassionate Guardian", () => {
  it("has the Shielded keyword", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, SOL).Build());

    expect(HasShielded(SOL)).toBe(true);
  });

  it("enters play with a Shield token when PLAYED", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, SOL).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(sol(g).upgrades.map(u => u.cardId)).toEqual([SHIELD]);
  });

  it("has no Sentinel before attacking", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, SOL).Build());

    expect(solHasSentinel(g)).toBe(false);
  });

  it("gains Sentinel on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, SOL).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(solHasSentinel(g)).toBe(true);
    expect(g.state.player2.base.damage).toBe(2); // the attack still landed
  });

  it("the Sentinel lasts the rest of the phase and is gone next round", async () => {
    const g = new GameTestAdapter();
    let b = setup().WithGroundUnitForPlayer(1, SOL);
    for (let i = 0; i < 4; i++) b = b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(2, MARINE);
    g.loadNewState(b.Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(solHasSentinel(g)).toBe(true);

    // Pass the round out — Phase-duration effects are cleared at the end of regroup.
    await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
    await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
    await g.passResourceAsync(g.state.activePlayer);
    await g.passResourceAsync(g.state.activePlayer);

    expect(solHasSentinel(g)).toBe(false);
  });

  it("the grant is Sol's alone — another friendly unit does not get it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, SOL)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    const solIdx = g.state.player1.groundArena.findIndex(u => u.cardId === SOL);
    await g.attackWithGroundUnitAsync(1, solIdx);
    await g.chooseBaseAsync(1, 2);

    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    expect(HasSentinel(marine.cardId, marine.playId, 1)).toBe(false);
    expect(solHasSentinel(g)).toBe(true);
  });
});
