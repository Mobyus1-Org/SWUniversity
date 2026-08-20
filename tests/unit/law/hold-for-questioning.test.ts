import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import type { NeedsPeekHand } from "@/lib/engine/message-types";

// LAW_217 Hold For Questioning (Event, cost 3, Cunning/Villainy) —
//   "Exhaust an enemy unit. If you do, look at its controller's hand and discard a card from it
//    that shares an aspect with that unit."
//
// "If you do" is a real gate: an already-exhausted unit is a legal target (targeting rules allow
// it) but exhausting it changes nothing, so no look and no discard follow. The discard filter is
// the EXHAUSTED UNIT's aspects, not the event's.

const HOLD = Cards.events.law.holdForQuestioning;
const MARINE = Cards.units.sor.battlefieldMarine;   // Command/Heroism
const CLONE = Cards.units.twi.phaseIClonetrooper;   // Heroism      — shares with the Marine
const STARFIGHTER = Cards.units.twi.droidStarfighter; // Villainy   — shares nothing with it

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sec.drydenVos) // Cunning/Villainy — covers the event's aspects
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, HOLD);
}

describe("LAW_217 Hold For Questioning", () => {
  it("exhausts the chosen enemy unit, then discards an aspect-sharing card from its hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, CLONE)        // Heroism — shares
        .WithCardInHandForPlayer(2, STARFIGHTER)  // Villainy — does not
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);

    const peek = g.lastDispatchResponse!.resolutionNeeded as NeedsPeekHand;
    expect(peek.type).toBe("PeekHand");
    expect(peek.targetPlayer).toBe(2);
    expect(peek.mustDiscard).toBe(true);
    expect(peek.eligibleIndices).toEqual([0]); // only the Heroism card

    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([STARFIGHTER]);
    expect(g.state.player2.discard.map(c => c.cardId)).toEqual([CLONE]);
  });

  it("rejects discarding a card that shares no aspect with the unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, STARFIGHTER) // Villainy — ineligible
        .WithCardInHandForPlayer(2, CLONE)       // Heroism  — the only legal pick
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] }); // the Starfighter

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.hand).toHaveLength(2);
  });

  it("still looks at the hand when nothing shares an aspect, but discards nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(2, STARFIGHTER) // Villainy unit — Droid Starfighter is SPACE
        .WithCardInHandForPlayer(2, CLONE)       // Heroism card — no overlap
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0); // Droid Starfighter is a SPACE unit

    expect(g.state.player2.spaceArena[0].ready).toBe(false); // the exhaust still happened

    const peek = g.lastDispatchResponse!.resolutionNeeded as NeedsPeekHand;
    expect(peek.type).toBe("PeekHand");
    expect(peek.mustDiscard).toBe(false); // a miss still gets the look
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([CLONE]);
  });

  it("an ALREADY-EXHAUSTED unit fails the 'if you do' — no look, no discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE, false) // already exhausted
        .WithCardInHandForPlayer(2, CLONE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([CLONE]);
    expect(g.state.player2.discard).toHaveLength(0);
  });

  it("exhausts with an empty enemy hand and simply ends", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("does not target a FRIENDLY unit — 'an enemy unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // the friendly Marine

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("with no enemy unit in play it is still playable and simply fizzles", async () => {
    // An event with no legal target may still be played; it just does nothing.
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([HOLD]);
  });
});
