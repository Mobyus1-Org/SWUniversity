import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_207 Jam Communications (Event, cost 1, Cunning/Heroism)
//   "Look at an opponent's hand and discard an event from it."

const MARINE = Cards.units.sor.battlefieldMarine;
const EVENT = Cards.events.sor.vanquish;
const UPGRADE = Cards.upgrades.sor.entrenched;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.jamCommunications);
}

type PeekRes = { type: "PeekHand"; mustDiscard: boolean; eligibleIndices: number[] };

describe("JTL_207 Jam Communications", () => {
  it("discards the chosen event from the opponent's hand — only events are eligible", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInHandForPlayer(2, MARINE)
      .WithCardInHandForPlayer(2, EVENT)
      .WithCardInHandForPlayer(2, UPGRADE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as PeekRes;
    expect(res.type).toBe("PeekHand");
    expect(res.mustDiscard).toBe(true);
    expect(res.eligibleIndices).toEqual([1]);

    await g.dispatchAsync(1, "choose-target", { targetIndices: [1] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE, UPGRADE]);
    expect(g.state.player2.discard.map(c => c.cardId)).toContain(EVENT);
    expect((g.state.roundState.cardsDiscardedThisPhase ?? []).some(c => c.cardId === EVENT && c.from === "Hand")).toBe(true);
  });

  it("a non-event pick is rejected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, EVENT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player2.hand).toHaveLength(2);
  });

  it("no event in hand: you still look, then dismiss without discarding", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, UPGRADE).Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as PeekRes;
    expect(res.type).toBe("PeekHand");
    expect(res.mustDiscard).toBe(false);

    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    expect(g.state.player2.hand).toHaveLength(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("empty opponent hand: nothing to look at", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
