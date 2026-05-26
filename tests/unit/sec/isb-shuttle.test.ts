import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_083 ISB Shuttle — When Played: If a friendly unit was defeated this phase, create a Spy token.
// Aspects: Command+Villainy (covered by Moff Gideon leader).

describe("SEC_083 ISB Shuttle", () => {
  it("creates a Spy token when a friendly unit was defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.units.sec.isbShuttle)
        .Build(),
    );

    // Simulate a friendly unit having been defeated this phase
    g.state.roundState.cardsLeftPlayThisPhase.push({
      cardId: Cards.units.sor.battlefieldMarine,
      fromPlayer: 1,
      reason: "defeated",
      playId: "test-defeated-unit",
    });

    await g.playCardFromHandAsync(1, 0);

    const spyTokens = g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.spy)
      .concat(g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.spy));
    expect(spyTokens).toHaveLength(1);
  });

  it("does nothing when no friendly unit was defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.units.sec.isbShuttle)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const spyTokens = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.spy);
    expect(spyTokens).toHaveLength(0);
  });
});
