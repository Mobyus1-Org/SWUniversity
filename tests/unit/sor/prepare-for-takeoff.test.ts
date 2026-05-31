import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_125 Prepare for Takeoff — Event (Command), cost 2
// "Search the top 8 cards of your deck for up to 2 Vehicle units, reveal them, and draw them."

describe("SOR_125 Prepare for Takeoff", () => {
  it("offers a deck search when deck has Vehicle units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.prepareForTakeoff)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [
      { cardId: Cards.units.sor.reinforcementWalker },
      { cardId: Cards.units.sor.blizzardAssaultAtAt },
    ];

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("DeckSearch");
  });

  it("draws chosen Vehicle units from the deck search", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.prepareForTakeoff)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [
      { cardId: Cards.units.sor.reinforcementWalker },
      { cardId: Cards.units.sor.battlefieldMarine }, // not a vehicle
    ];

    await g.playCardFromHandAsync(1, 0);
    // deck: [RW(idx0), marine(idx1)] — RW gets tempId "0"; marine not a Vehicle → not in results
    await g.chooseDeckSearchAsync(1, ["0"]);

    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.reinforcementWalker)).toBe(true);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
  });

  it("auto-resolves with no search when deck is empty", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.prepareForTakeoff)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [];

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
