import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";

// LAW_242 Improvise (Event, cost 1)
//   "Look at the top card of your deck. You may play it. It costs 1 resource less.
//    If you don't, you may discard it."
//
// Three outcomes: play it for 1 less, discard it, or leave it on top. The discard offer only
// appears when you DECLINE to play ("if you don't"), mirroring SOR_192 Ezra Bridger.

const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;
const readyRes = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 16)
    .WithCardInHandForPlayer(1, Cards.events.law.improvise)
    .WithCardInDeckForPlayer(1, CSF); // top of deck (drawn from the END)
}

describe("LAW_242 Improvise", () => {
  it("plays the top card for 1 resource less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const full = playCost(g.state, 1, CSF);

    await g.playCardFromHandAsync(1, 0);
    const afterEvent = readyRes(g);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === CSF)).toBe(true);
    expect(readyRes(g)).toBe(afterEvent - (full - 1));
    expect(g.state.player1.deck).toHaveLength(0);
  });

  it("offers the discard only after declining to play, and discards it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);  // don't play
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined(); // now the discard offer
    await g.chooseYesAsync(1); // discard it

    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player1.discard.some(d => d.cardId === CSF)).toBe(true);
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("can leave the card on top — declining both offers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // don't play
    await g.chooseNoAsync(1); // don't discard

    expect(g.state.player1.deck).toHaveLength(1);
    expect(g.state.player1.deck[0].cardId).toBe(CSF);
    expect(g.state.player1.discard.some(d => d.cardId === CSF)).toBe(false);
  });

  it("skips straight to the discard offer when the card is unaffordable", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        // Enough for Improvise itself (Cunning, so it carries a +2 aspect penalty here) but
        // not enough left over for the discounted Consular Security Force.
        .FillResourcesForPlayer(1, MARINE, 5)
        .WithCardInHandForPlayer(1, Cards.events.law.improvise)
        .WithCardInDeckForPlayer(1, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // the only offer is the discard — Yes discards

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.some(d => d.cardId === CSF)).toBe(true);
  });

  it("resolves harmlessly with an empty deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 16)
        .WithCardInHandForPlayer(1, Cards.events.law.improvise)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });
});
