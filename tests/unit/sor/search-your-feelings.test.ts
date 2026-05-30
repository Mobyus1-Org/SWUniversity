import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_042 Search Your Feelings", () => {
  it("searches entire deck and draws the chosen card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic) // Vigilance + Villainy
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.searchYourFeelings)
      .Build();
    g.loadNewState(state);

    state.player1.deck = [
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: Cards.units.sor.atAtSuppressor },
    ];
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    // DeckSearch pending: tempId "0" = battlefieldMarine (bottom), tempId "1" = atAtSuppressor (top)
    await g.chooseDeckSearchAsync(1, ["1"]);

    // Played 1 card (-1), drew 1 (+1) = net 0
    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 1);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.atAtSuppressor)).toBe(true);
  });

  it("shuffles unchosen cards back into deck", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.searchYourFeelings)
      .Build();
    g.loadNewState(state);

    state.player1.deck = [
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: Cards.units.sor.atAtSuppressor },
    ];

    await g.playCardFromHandAsync(1, 0);
    await g.chooseDeckSearchAsync(1, ["2"]); // choose atAtSuppressor (top card)

    // Drawn card goes to hand
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.atAtSuppressor)).toBe(true);
    // Remaining 2 cards shuffled back into deck
    expect(g.state.player1.deck.length).toBe(2);
  });

  it("fizzles when deck is empty", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.searchYourFeelings)
      .Build();
    g.loadNewState(state);

    state.player1.deck = [];

    await g.playCardFromHandAsync(1, 0);

    // No deck-search pending — resolves immediately with no effect
    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.deck.length).toBe(0);
  });
});
