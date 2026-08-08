import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_214 Frontier Trader — "When Played: You may return a resource you control to its owner's
// hand. If you do, you may put the top card of your deck into play as a resource."
//
// Two NESTED optionals: the second is only offered if the first actually happened, so all four
// branches need covering. The returned card goes to its OWNER's hand, which is not necessarily
// the controller — a stolen resource goes back to the opponent.

const MARINE = Cards.units.sor.battlefieldMarine;
const DECK_CARD = Cards.units.sor.consularSecurityForce;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInDeckForPlayer(1, DECK_CARD)
    .WithCardInHandForPlayer(1, Cards.units.shd.frontierTrader);
}

describe("SHD_214 Frontier Trader", () => {
  it("returns the chosen resource to hand and replaces it from the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const resBefore = g.state.player1.resources.length;
    const deckBefore = g.state.player1.deck.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.choosePlotCardAsync(1, 0); // target resource index 0
    await g.chooseYesAsync(1);

    expect(g.state.player1.resources).toHaveLength(resBefore); // -1 returned, +1 from deck
    expect(g.state.player1.deck).toHaveLength(deckBefore - 1);
    expect(g.state.player1.hand.some(c => c.cardId === MARINE)).toBe(true);
  });

  it("can return a resource and decline the deck replacement", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const resBefore = g.state.player1.resources.length;
    const deckBefore = g.state.player1.deck.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.choosePlotCardAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.resources).toHaveLength(resBefore - 1);
    expect(g.state.player1.deck).toHaveLength(deckBefore);
    expect(g.state.player1.hand.some(c => c.cardId === MARINE)).toBe(true);
  });

  it("declining the return skips the deck replacement entirely", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const resBefore = g.state.player1.resources.length;
    const deckBefore = g.state.player1.deck.length;
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    await g.chooseNoAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.resources).toHaveLength(resBefore);
    expect(g.state.player1.deck).toHaveLength(deckBefore);
    expect(g.state.player1.hand).toHaveLength(handBefore - 1); // only Frontier Trader left hand
  });

  it("returns a stolen resource to its OWNER's hand, not the controller's", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup().Build();
    // A resource sitting in P1's control zone but OWNED by P2 — what a steal effect leaves
    // behind. FillResourcesForPlayer always pushes into the owner's own array, so it cannot
    // express this; the resource is placed directly.
    state.player1.resources.push({
      cardId: DECK_CARD, playId: "stolen-1", owner: 2, controller: 1, ready: true, stolen: true,
    });
    g.loadNewState(state);
    const p2HandBefore = g.state.player2.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const stolen = g.state.player1.resources.find(r => r.owner === 2)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [stolen.playId] });
    await g.chooseNoAsync(1);

    expect(g.state.player2.hand).toHaveLength(p2HandBefore + 1);
    expect(g.state.player1.resources.some(r => r.owner === 2)).toBe(false);
  });

  it("still puts the unit into play when the deck is empty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 12)
        .WithCardInHandForPlayer(1, Cards.units.shd.frontierTrader)
        .Build(),
    );
    const resBefore = g.state.player1.resources.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.choosePlotCardAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.shd.frontierTrader)).toBe(true);
    expect(g.state.player1.resources).toHaveLength(resBefore - 1); // nothing to replace it with
  });
});
