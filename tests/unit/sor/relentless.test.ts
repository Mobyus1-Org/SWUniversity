import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_089 Relentless (Capital Ship, Space, Command/Villainy, 9/8/8)
// "The first event played by each opponent each round loses all abilities."
//
// Ruling: events played before Relentless entered play still count as the
// first event for that player this round — Relentless does not blank their
// subsequent events.

describe("SOR_089 Relentless", () => {
  it("blanks the first event played by an opponent while in play", async () => {
    // Strike True normally prompts P2 to choose a friendly attacker unit.
    // With Relentless in play it should be blanked — no target prompt fires.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.relentless)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.discard[0].cardId).toBe(Cards.events.sor.strikeTrue);
    // No units are harmed — blanked event dealt no damage
    expect(g.state.player1.spaceArena[0].damage).toBe(0);
  });

  it("does not blank the second event played by the same opponent", async () => {
    // Play Strike True twice in the same round. First is blanked, second fires normally.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.relentless)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithActivePlayer(2)
        .Build(),
    );

    // First event — blanked
    await g.playCardFromHandAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();

    // Player 1 passes so Player 2 gets another turn
    await g.dispatchAsync(1, "pass-action", {});

    // Second event — not blanked, prompts for a target
    await g.playCardFromHandAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });

  it("does not blank events played by its own controller", async () => {
    // Player 1 controls Relentless and plays Strike True themselves — no blanking.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.relentless)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // Controller's Strike True should prompt normally
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });

  it("does not blank a second event when the opponent already played one this round before Relentless entered play", async () => {
    // Simulate: P2 played an event earlier this round (before Relentless entered).
    // Relentless should see the prior event and not blank P2's next one.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.relentless)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithActivePlayer(2)
        .Build(),
    );

    // Inject a prior event into cardsPlayedThisRound for P2 (pre-Relentless play)
    g.state.roundState.cardsPlayedThisRound.push({
      fromPlayer: 2,
      cardId: Cards.events.sor.strikeTrue,
      playId: "prior-event",
      playedAs: "Event",
    });

    await g.playCardFromHandAsync(2, 0);

    // This is P2's second event this round — should NOT be blanked
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });

  it("does not blank events when Relentless has lost all abilities", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.relentless)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithActivePlayer(2)
        .Build(),
    );

    const relentlessPlayId = g.state.player1.spaceArena[0].playId;
    g.state.currentEffects.push({
      cardId: "SOR_138",
      duration: "Round",
      affectedPlayer: 1,
      targetPlayId: relentlessPlayId,
    });

    await g.playCardFromHandAsync(2, 0);

    // Relentless has lost abilities — should not blank the event
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });
});
