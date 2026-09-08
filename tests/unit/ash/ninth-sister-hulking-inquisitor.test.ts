import { describe, it, expect } from "vitest";

import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_148 Ninth Sister — Hulking Inquisitor. Cost 7, 8/7 Ground Force/Imperial/Inquisitor, unique.
//   "Overwhelm
//    When Played: An opponent discards a card from their hand. You may deal damage equal to its
//    cost divided as you choose among any number of units."
//
// The OPPONENT picks which card to lose; the damage is its printed cost, and the spread is
// optional and unrestricted — any number of units, on either side of the table.

const NINTH = Cards.units.ash.ninthSister;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3 Ground
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const COST_4 = Cards.units.sor.wampa;                   // cost 4
const COST_1 = "SOR_236";                               // R2-D2, cost 1
const COST_0 = "SOR_245";                               // Medal Ceremony — costs 0

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, NINTH);
}

const dmg = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.find(u => u.cardId === cardId)?.damage;

describe("ASH_148 Ninth Sister — Hulking Inquisitor", () => {
  it("has Overwhelm", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, NINTH).Build());
    const playId = g.state.player1.groundArena[0].playId;
    // A defender must be supplied for Overwhelm to report — it only matters when attacking a unit.
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, NINTH)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );
    const ninth = g.state.player1.groundArena[0];
    const victim = g.state.player2.groundArena[0];
    expect(HasOverwhelm(NINTH, ninth.playId, 1, victim.playId, 2)).toBe(true);
    void playId;
  });

  it("makes the opponent discard, then spreads damage equal to that card's cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(2, COST_4)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    // The opponent chooses which card to discard.
    await g.chooseCardFromHandAsync(2, 0);
    const mine = g.state.player1.groundArena.find(u => u.cardId === SECURITY)!;
    const theirs = g.state.player2.groundArena.find(u => u.cardId === SECURITY)!;
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: mine.playId, damage: 1 },
        { playId: theirs.playId, damage: 3 },
      ],
    });

    expect(g.state.player2.discard.some(c => c.cardId === COST_4)).toBe(true);
    expect(dmg(g, 1, SECURITY)).toBe(1);
    expect(dmg(g, 2, SECURITY)).toBe(3);
  });

  it("is optional — assigning none deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(2, COST_4)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);
    const res = await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [] });

    // Assigning nothing must be ACCEPTED, not rejected — otherwise "you may" is not optional and
    // the zero damage below would just be the engine refusing the input.
    expect(res.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.state.player2.discard.some(c => c.cardId === COST_4)).toBe(true);
    expect(dmg(g, 2, SECURITY)).toBe(0);
  });

  it("offers no damage step when the discarded card costs 0", async () => {
    // A 0-cost card carries NO cost entry in the generated data, so this also guards against a
    // fallback that would turn "no cost" into some large number.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(2, COST_0)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player2.discard.some(c => c.cardId === COST_0)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(dmg(g, 2, SECURITY)).toBe(0);
  });

  it("scales with the discarded card's cost — a 1-cost card yields exactly 1 damage", async () => {
    // Proves the amount is read off the discarded card rather than being a constant.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(2, COST_1)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);
    const theirs = g.state.player2.groundArena[0];
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: theirs.playId, damage: 1 }],
    });

    expect(dmg(g, 2, SECURITY)).toBe(1);
  });

  it("does nothing when the opponent's hand is empty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.groundArena.some(u => u.cardId === NINTH)).toBe(true);
    expect(dmg(g, 2, SECURITY)).toBe(0);
  });

  it("can pile the whole amount onto one unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(2, COST_4)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);
    const theirs = g.state.player2.groundArena[0];
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: theirs.playId, damage: 4 }],
    });

    expect(dmg(g, 2, SECURITY)).toBe(4);
  });
});
