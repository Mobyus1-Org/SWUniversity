import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";

// HMW_204 Nightbrother — Maul's Gauntlet (6/7 Space, cost 7, unique, Cunning/Villainy)
//   "When Played: You may play a unit from your discard pile. It costs 3 resources less and enters
//    play ready. At the start of the next regroup phase, defeat it."
//
// Cunning comes from the base and Villainy from the leader, so Nightbrother costs its printed 7.
// The discard units below are Villainy-only (no aspect penalty), so their costs are printed too.

const NIGHTBROTHER = Cards.units.hmw.nightbrotherMaulsGauntlet;
const ARMY = Cards.units.lof.armyOfTheDead;          // cost 6, 7/6 Ground
const TROOPERS = Cards.units.ash.deathTrooperSquad;  // cost 4, 5/4 Ground
const TIE = Cards.units.ibh.scoutingTieFighter;      // cost 2, 2/2 Space
const VWING = Cards.units.sor.patrollingVWing;       // cost 2 (+2 off-aspect), "When Played: Draw a card"
const EVENT = Cards.events.sor.confiscate;           // an event in the discard is never playable here

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)         // Cunning
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)   // Command/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(1)
    .WithCardInHandForPlayer(1, NIGHTBROTHER);
}

/** Seeds a discard pile entry and returns its playId (discards are hand-built, as in other tests). */
function discard(state: GameState, player: PlayerId, cardId: string, playId: string) {
  const p = player === 1 ? state.player1 : state.player2;
  p.discard.unshift({ cardId, playId, owner: player, controller: player, turnDiscarded: 1, discardEffect: "" });
  return playId;
}

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];
const allUnits = (g: GameTestAdapter, p: 1 | 2 = 1) =>
  [...(p === 1 ? g.state.player1 : g.state.player2).groundArena, ...(p === 1 ? g.state.player1 : g.state.player2).spaceArena];

describe("HMW_204 Nightbrother — Maul's Gauntlet", () => {
  it("plays a unit from the discard pile for 3 less, and it enters ready", async () => {
    const g = new GameTestAdapter();
    const s = base().FillResourcesForPlayer(1, TROOPERS, 10).Build();
    const armyId = discard(s, 1, ARMY, "d-army");
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);           // Nightbrother: 7 of 10
    expect(readyResources(g)).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [armyId] });

    const army = g.state.player1.groundArena.find(u => u.cardId === ARMY)!;
    expect(army).toBeDefined();
    expect(army.ready).toBe(true);
    expect(readyResources(g)).toBe(0);             // 6 − 3 = 3, all spent
    expect(g.state.player1.discard.some(d => d.cardId === ARMY)).toBe(false);
  });

  it("second cost point pins the discount at 3: a 4-cost unit costs 1", async () => {
    const g = new GameTestAdapter();
    const s = base().FillResourcesForPlayer(1, TROOPERS, 10).Build();
    const troopersId = discard(s, 1, TROOPERS, "d-troopers");
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [troopersId] });

    expect(g.state.player1.groundArena.some(u => u.cardId === TROOPERS)).toBe(true);
    expect(readyResources(g)).toBe(2);             // 10 − 7 − 1
  });

  it("the cost floors at 0 — a 2-cost unit is free, not a refund", async () => {
    const g = new GameTestAdapter();
    const s = base().FillResourcesForPlayer(1, TROOPERS, 7).Build();
    const tieId = discard(s, 1, TIE, "d-tie");
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [tieId] });

    expect(g.state.player1.spaceArena.some(u => u.cardId === TIE)).toBe(true);
    expect(readyResources(g)).toBe(0);
    expect(g.state.player1.resources).toHaveLength(7);
  });

  it("entering ready is real — the replayed unit attacks the same turn", async () => {
    const g = new GameTestAdapter();
    const s = base().FillResourcesForPlayer(1, TROOPERS, 10).Build();
    const troopersId = discard(s, 1, TROOPERS, "d-troopers");
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [troopersId] });
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);   // Death Trooper Squad's power
  });

  it("offers only affordable units from YOUR discard — no events, nothing too expensive", async () => {
    const g = new GameTestAdapter();
    const s = base().FillResourcesForPlayer(1, TROOPERS, 9).Build(); // 2 left after Nightbrother
    const troopersId = discard(s, 1, TROOPERS, "d-troopers");        // 4 − 3 = 1 ✓
    const tieId = discard(s, 1, TIE, "d-tie");                       // 2 − 3 → 0 ✓
    discard(s, 1, ARMY, "d-army");                                   // 6 − 3 = 3 ✗ (only 2 left)
    discard(s, 1, EVENT, "d-event");                                 // not a unit ✗
    discard(s, 2, TROOPERS, "d-enemy");                              // enemy discard ✗
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect([...offer(g)].sort()).toEqual([troopersId, tieId].sort());
  });

  it("declining plays nothing and leaves the discard alone", async () => {
    const g = new GameTestAdapter();
    const s = base().FillResourcesForPlayer(1, TROOPERS, 10).Build();
    discard(s, 1, ARMY, "d-army");
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.discard.map(d => d.cardId)).toEqual([ARMY]);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(readyResources(g)).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("no prompt at all when nothing in the discard is affordable at -3", async () => {
    const g = new GameTestAdapter();
    const s = base().FillResourcesForPlayer(1, TROOPERS, 7).Build(); // 0 left after Nightbrother
    discard(s, 1, ARMY, "d-army");                                   // still costs 3
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.spaceArena.some(u => u.cardId === NIGHTBROTHER)).toBe(true);
    expect(g.state.player1.discard.map(d => d.cardId)).toEqual([ARMY]);
  });

  it("an empty discard pile gives no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().FillResourcesForPlayer(1, TROOPERS, 10).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.spaceArena.some(u => u.cardId === NIGHTBROTHER)).toBe(true);
  });

  it("the replayed unit's own When Played still fires", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .FillResourcesForPlayer(1, TROOPERS, 12)
      .WithCardInDeckForPlayer(1, TROOPERS)
      .Build();
    const vwingId = discard(s, 1, VWING, "d-vwing"); // "When Played: Draw a card"
    g.loadNewState(s);
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vwingId] });

    expect(g.state.player1.spaceArena.some(u => u.cardId === VWING)).toBe(true);
    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 1); // Nightbrother left, V-Wing drew
  });

  it("the nested play does not grant an extra action", async () => {
    const g = new GameTestAdapter();
    const s = base().FillResourcesForPlayer(1, TROOPERS, 10).Build();
    const armyId = discard(s, 1, ARMY, "d-army");
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [armyId] });

    expect(g.state.activePlayer).toBe(2);
  });

  it("the replayed unit is defeated at the start of the next regroup phase — nothing else is", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .FillResourcesForPlayer(1, TROOPERS, 10)
      .WithGroundUnitForPlayer(1, TROOPERS)   // a unit that was already in play — must survive
      .WithCardInDeckForPlayer(1, TROOPERS).WithCardInDeckForPlayer(1, TROOPERS)
      .WithCardInDeckForPlayer(2, TROOPERS).WithCardInDeckForPlayer(2, TROOPERS)
      .Build();
    const armyId = discard(s, 1, ARMY, "d-army");
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [armyId] });
    expect(g.state.player1.groundArena.some(u => u.cardId === ARMY)).toBe(true);

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.player1.groundArena.some(u => u.cardId === ARMY)).toBe(false);
    expect(g.state.player1.discard.some(d => d.cardId === ARMY)).toBe(true);
    // Nightbrother and the pre-existing unit are untouched.
    expect(allUnits(g).some(u => u.cardId === NIGHTBROTHER)).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === TROOPERS)).toBe(true);
  });

  it("a replayed unit that already left play is not hit by the delayed defeat", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .FillResourcesForPlayer(1, TROOPERS, 20) // Nightbrother 7 + Army 3 + Vanquish (off-aspect)
      .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
      .WithCardInDeckForPlayer(1, TROOPERS).WithCardInDeckForPlayer(1, TROOPERS)
      .WithCardInDeckForPlayer(2, TROOPERS).WithCardInDeckForPlayer(2, TROOPERS)
      .Build();
    const armyId = discard(s, 1, ARMY, "d-army");
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);                 // Nightbrother (hand index 0)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [armyId] });
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);                 // Vanquish
    await g.chooseGroundUnitAsync(1, 0);                 // defeat the replayed unit now
    expect(g.state.player1.groundArena).toHaveLength(0);

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    // The marker found nothing and did nothing — Nightbrother is still in play.
    expect(g.state.player1.spaceArena.some(u => u.cardId === NIGHTBROTHER)).toBe(true);
  });
});
