import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_171 Mission Briefing", () => {
  it("Yes: the playing player draws 2 cards", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Aggression covers SOR_171's Aggression
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.missionBriefing)
      .Build();
    g.loadNewState(state);

    // Add deck cards for player 1 to draw
    state.player1.deck = [
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: Cards.units.sor.battlefieldMarine },
    ];
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Yes = draw for self

    // Played 1 card (-1), drew 2 (+2) = net +1
    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 2);
  });

  it("No: the opponent draws 2 cards", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.missionBriefing)
      .Build();
    g.loadNewState(state);

    state.player2.deck = [
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: Cards.units.sor.battlefieldMarine },
    ];
    const oppHandBefore = g.state.player2.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // No = draw for opponent

    expect(g.state.player2.hand.length).toBe(oppHandBefore + 2);
    expect(g.state.player1.hand.length).toBe(0); // played the card, drew nothing
  });
});
