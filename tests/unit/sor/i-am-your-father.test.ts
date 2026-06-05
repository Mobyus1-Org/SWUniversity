import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_233 I Am Your Father (Event) — Villainy, Cost 5
// Deal 7 damage to an enemy unit unless its controller says 'no.'
// If they do, draw 3 cards.

describe("SOR_233 I Am Your Father", () => {
  it("opponent says yes: deals 7 damage to the targeted enemy unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.lukeSkywalker)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.iAmYourFather)
      .Build();
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    // Player 1 targets the enemy unit
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // Opponent (player 2) gets the choice
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(2); // Take 7 damage

    expect(g.state.player2.groundArena[0]?.damage ?? 0).toBe(7);
  });

  it("opponent says no: casting player draws 3 cards", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.lukeSkywalker)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.iAmYourFather)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;
    const initialHandSize = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(2); // Say no — opponent draws 3

    // Unit takes no damage
    expect(g.state.player2.groundArena[0]?.damage ?? 0).toBe(0);
    // Player 1 drew 3 cards (hand is smaller by 1 for the played event, then +3)
    expect(g.state.player1.hand.length).toBe(initialHandSize - 1 + 3);
  });
});
