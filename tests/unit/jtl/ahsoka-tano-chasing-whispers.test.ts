import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_201 Ahsoka Tano — Chasing Whispers (3/5 Ground, cost 4, unique, Cunning/Heroism)
//   "When Played: An opponent discards a card from their hand. If it's a unit, you may exhaust a unit."
//
// The OPPONENT chooses the card; the follow-up reads the card they actually discarded.

const AHSOKA = Cards.units.jtl.ahsokaTanoChasingWhispers;
const MARINE = Cards.units.sor.battlefieldMarine;  // unit
const EVENT = Cards.events.sor.vanquish;            // event
const WAMPA = Cards.units.sor.wampa;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, AHSOKA)
    .WithGroundUnitForPlayer(2, WAMPA);
}

describe("JTL_201 Ahsoka Tano — Chasing Whispers", () => {
  it("opponent discards a unit → you may exhaust a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);
    expect(g.state.player2.discard.map(c => c.cardId)).toContain(MARINE);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("any unit can be exhausted — Ahsoka herself included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    const ahsoka = g.state.player1.groundArena.find(u => u.cardId === AHSOKA)!;
    expect(res.fromPlayIds).toEqual(expect.arrayContaining([ahsoka.playId, g.state.player2.groundArena[0].playId]));
  });

  it("declining leaves every unit alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("opponent discards a non-unit → no exhaust offer, even with a unit already in their discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInHandForPlayer(2, MARINE)
      .WithCardInHandForPlayer(2, EVENT)
      .WithCardInDiscardForPlayer(2, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 1); // the opponent picks the event

    expect(g.state.player2.discard.map(c => c.cardId)).toContain(EVENT);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("opponent's hand is empty → nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDiscardForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("the discard counts as a discard from hand (when-discarded ledger)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(2, 0);

    expect((g.state.roundState.cardsDiscardedThisPhase ?? []).some(c => c.cardId === MARINE)).toBe(true);
  });
});
