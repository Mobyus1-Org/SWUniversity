import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_084 Grand Moff Tarkin (unit) — 2/3 Ground (Command+Villainy)
// When Played: Search the top 5 cards of your deck for up to 2 Imperial cards,
// reveal them, and draw them.

describe("SOR_084 Grand Moff Tarkin (unit)", () => {
  it("offers deck search when Imperial cards are in the top 5", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.grandMoffTarkinUnit)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.seasonedShoretrooper }]; // Imperial

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("DeckSearch");
  });

  it("draws up to 2 Imperial cards from top 5", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.grandMoffTarkinUnit)
      .Build();
    g.loadNewState(state);
    const imperial1 = Cards.units.sor.seasonedShoretrooper; // Imperial,Trooper — tempId "1"
    const imperial2 = Cards.units.sor.deathTrooper;          // Imperial,Trooper — tempId "2"
    // deck: [marine(0), imperial2(1), imperial1(2)] — imperial1 is top
    state.player1.deck = [
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: imperial2 },
      { cardId: imperial1 },
    ];

    await g.playCardFromHandAsync(1, 0);
    // Select both Imperial cards (tempIds "1" and "2")
    await g.chooseDeckSearchAsync(1, ["1", "2"]);

    expect(g.state.player1.hand.some(c => c.cardId === imperial1)).toBe(true);
    expect(g.state.player1.hand.some(c => c.cardId === imperial2)).toBe(true);
  });

  it("does nothing when deck has no Imperial cards in top 5", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.grandMoffTarkinUnit)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }]; // not Imperial

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
