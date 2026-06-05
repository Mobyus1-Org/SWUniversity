import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_190 Lothal Insurgent — Cost 2, 3/2, Ground, Cunning+Heroism
// When Played: If you played another card this phase, each opponent draws a card
// then discards a random card from their hand.

describe("SOR_190 Lothal Insurgent", () => {
  it("fires when another card was played this phase: opponent draws then discards random", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla) // Command+Heroism; LI costs 2+2(Cunning)=4
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.lothalInsurgent)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    // Simulate that another card was already played this phase
    state.roundState.cardsPlayedThisPhase.push({ fromPlayer: 1, cardId: Cards.units.sor.battlefieldMarine, playId: "fake-1" });

    const oppHandBefore = g.state.player2.hand.length; // 1

    await g.playCardFromHandAsync(1, 0);

    // Opponent drew 1 (hand: 1→2) then discarded 1 (hand: 2→1); net unchanged
    expect(g.state.player2.hand.length).toBe(oppHandBefore);
    expect(g.state.player2.discard.length).toBe(1);
    expect(g.state.player2.deck.length).toBe(0);
  });

  it("does not fire when Lothal Insurgent is the first card played this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.lothalInsurgent)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    // No fake entries — LI is the first card played

    const oppHandBefore = g.state.player2.hand.length;
    const oppDeckBefore = g.state.player2.deck.length;

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.hand.length).toBe(oppHandBefore);
    expect(g.state.player2.deck.length).toBe(oppDeckBefore);
    expect(g.state.player2.discard.length).toBe(0);
  });
});
