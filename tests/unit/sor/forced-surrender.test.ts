import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_175 Forced Surrender (Event, Aggression, cost 6)
// Draw 2 cards. Each opponent whose base you've damaged this phase discards 2 cards from their hand.

describe("SOR_175 Forced Surrender", () => {
  it("always draws 2 cards for the player", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.events.sor.forcedSurrender)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(2); // drew 2 from deck
  });

  it("opponent discards 2 cards if their base was damaged this phase (via combat)", async () => {
    const g = new GameTestAdapter();
    new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.events.sor.forcedSurrender)
      .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
      .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
      .WithCardInHandForPlayer(2, Cards.events.sor.disarm)
      .WithActivePlayer(1);

    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.events.sor.forcedSurrender)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
        .WithCardInHandForPlayer(2, Cards.events.sor.disarm)
        .WithActivePlayer(1)
        .Build(),
    );

    // P1 attacks P2's base (base damage recorded)
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // P2 passes their action
    await g.dispatchAsync(2, "pass-action", {});

    // P1 plays Forced Surrender — opponent (P2) had base damaged this phase
    await g.playCardFromHandAsync(1, 0);

    // P2 must discard 2 cards
    await g.chooseCardFromHandAsync(2, 0);
    await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player2.hand.length).toBe(1); // started with 3, discarded 2
  });

  it("opponent does not discard if their base was not damaged this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.events.sor.forcedSurrender)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // no base damage dealt this phase
    // No discard prompt for P2
    expect(g.state.player2.hand.length).toBe(2); // unchanged
  });
});
