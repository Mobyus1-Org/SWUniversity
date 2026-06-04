import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_174 Smoke and Cinders (Event, Aggression, cost 5)
// Each player discards all but 2 cards (of their choice) from their hand.

describe("SOR_174 Smoke and Cinders", () => {
  it("each player with more than 2 cards discards down to 2", async () => {
    const g = new GameTestAdapter();
    new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP) // Aggression for SOR_174
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      // P1: SOR_174 + 3 filler cards = 4 in hand; after playing: 3 remain → discard 1
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.smokeAndCinders)
      .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
      .WithCardInHandForPlayer(1, Cards.events.sor.openFire)
      .WithCardInHandForPlayer(1, Cards.events.sor.disarm)
      // P2: 4 cards → discard 2
      .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
      .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
      .WithCardInHandForPlayer(2, Cards.events.sor.disarm)
      .WithCardInHandForPlayer(2, Cards.events.sor.bombingRun);

    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithCardInHandForPlayer(1, Cards.events.sor.smokeAndCinders)
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(1, Cards.events.sor.openFire)
        .WithCardInHandForPlayer(1, Cards.events.sor.disarm)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
        .WithCardInHandForPlayer(2, Cards.events.sor.disarm)
        .WithCardInHandForPlayer(2, Cards.events.sor.bombingRun)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // play Smoke and Cinders (P1 hand goes from 4 → 3)
    // P1 must discard 1 (keep 2): discard index 0
    await g.chooseCardFromHandAsync(1, 0);
    // P2 must discard 2: discard index 0 twice
    await g.chooseCardFromHandAsync(2, 0);
    await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player1.hand.length).toBe(2);
    expect(g.state.player2.hand.length).toBe(2);
  });

  it("players with 2 or fewer cards are unaffected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithCardInHandForPlayer(1, Cards.events.sor.smokeAndCinders)
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        // P2: exactly 2 cards
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // P1 hand: 2 → 1 after play (no discard needed)
    // No discard choices needed — state resolves immediately

    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player2.hand.length).toBe(2);
  });
});
