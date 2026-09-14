import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_052 Watch This (Event, cost 6, Cunning)
//   "Return a non-leader unit that costs 6 or less to its owner's hand. Exhaust each other enemy
//    unit in the same arena."
//
// "The same arena" is the arena the returned unit was in; "enemy" is relative to the player.

const EVENT = Cards.events.ibh.watchThis;
const MARINE = Cards.units.sor.battlefieldMarine;         // cost 2 Ground
const WAMPA = Cards.units.sor.wampa;                      // cost 4 Ground
const LUKE = Cards.units.sor.lukeSkywalker;               // cost 7 Ground — too expensive
const SPACE = Cards.units.lof.hyperspaceWayfarer;         // Space
const CHEWIE = Cards.units.jtl.chewbacca;                 // can't be returned by enemy abilities

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInHandForPlayer(1, EVENT);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds ?? [];

describe("IBH_052 Watch This", () => {
  it("returns an enemy ground unit, then exhausts the OTHER enemy ground units only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)       // friendly — never exhausted
        .WithGroundUnitForPlayer(2, MARINE)       // the one returned
        .WithGroundUnitForPlayer(2, WAMPA)        // other enemy ground — exhausted
        .WithSpaceUnitForPlayer(2, SPACE)         // other arena — untouched
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player2.groundArena.map(u => [u.cardId, u.ready])).toEqual([[WAMPA, false]]);
    expect(g.state.player2.spaceArena[0].ready).toBe(true);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("returning your OWN unit exhausts every enemy unit in its arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player2.groundArena.every(u => !u.ready)).toBe(true);
  });

  it("returning a space unit leaves the ground ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, SPACE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("only non-leader units costing 6 or less are offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithGroundUnitForPlayer(2, LUKE)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // a leader unit
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g)).toEqual([g.state.player2.groundArena[0].playId]);
  });

  it("Chewbacca can be chosen but stays — the rest of his arena is still exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CHEWIE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(offer(g)).toContain(g.state.player2.groundArena[0].playId);
    await g.chooseGroundUnitAsync(2, 0);

    const chewie = g.state.player2.groundArena.find(u => u.cardId === CHEWIE)!;
    expect(chewie).toBeDefined();
    expect(chewie.ready).toBe(true); // not "other" — and not returned
    expect(g.state.player2.groundArena.find(u => u.cardId === WAMPA)!.ready).toBe(false);
  });

  it("no units at all — the event just resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
