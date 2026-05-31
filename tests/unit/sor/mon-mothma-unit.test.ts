import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_096 Mon Mothma (unit) — 1/2 Ground (Command+Heroism)
// When Played: Search the top 5 cards of your deck for a REBEL card,
// reveal it, and draw it.

describe("SOR_096 Mon Mothma (unit)", () => {
  it("offers deck search when a Rebel card is in the top 5", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.monMothmaUnit)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.kananJarrus }]; // Rebel

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("DeckSearch");
  });

  it("draws the chosen Rebel card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.monMothmaUnit)
      .Build();
    g.loadNewState(state);
    // deck: [marine(0), kanan(1)] — kanan is top (index 1), tempId "1"
    state.player1.deck = [
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: Cards.units.sor.kananJarrus },
    ];

    await g.playCardFromHandAsync(1, 0);
    // Select Kanan (tempId "1", the only eligible Rebel card)
    await g.chooseDeckSearchAsync(1, ["1"]);

    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.kananJarrus)).toBe(true);
  });

  it("does nothing when no Rebel card in top 5", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.monMothmaUnit)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.darthVader }]; // no Rebel trait

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
