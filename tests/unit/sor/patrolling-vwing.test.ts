import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_111 Patrolling V-Wing", () => {
  it("When Played: draws a card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP) // Command base covers SOR_111's Command aspect
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3) // cost=2 (Command covered by base), have 3
      .WithCardInHandForPlayer(1, Cards.units.sor.patrollingVWing)
      .Build();
    g.loadNewState(state);

    // Add a card to deck so draw works
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);

    // Played 1 card (-1), drew 1 card (+1) = net 0
    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 1);
    expect(g.state.player1.deck.length).toBe(0);
  });
});
