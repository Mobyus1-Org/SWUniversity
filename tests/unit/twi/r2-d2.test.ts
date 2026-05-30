import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("TWI_193 R2-D2 (Full of Solutions) — When Played deck search", () => {
  it("draws a card after discarding when player chooses to discard", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6) // cost 2 + 4 aspect penalty (Cunning,Heroism not covered)
      .WithCardInDeckForPlayer(1, Cards.units.sor.cellBlockGuard) // will be drawn
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // will be discarded
      .WithCardInHandForPlayer(1, Cards.units.twi.r2d2FullOfSolutions)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 1); // play R2-D2
    // Ability option: "Discard a card?"
    await g.chooseYesAsync(1);
    // Discard from hand (index 0 = Battlefield Marine)
    await g.chooseCardFromHandAsync(1, 0);
    // DeckSearch pending: "r2-0" = Cell Block Guard
    await g.chooseDeckSearchAsync(1, ["0"]);

    // Hand: started with 2, played R2-D2 (-1), discarded 1 (-1), drew 1 (+1) = 1
    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player1.hand[0].cardId).toBe(Cards.units.sor.cellBlockGuard);
    expect(g.state.player1.deck.length).toBe(0);
  });

  it("skips the deck search when player declines to discard", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6) // cost 2 + 4 aspect penalty (Cunning,Heroism not covered)
      .WithCardInDeckForPlayer(1, Cards.units.sor.cellBlockGuard)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.twi.r2d2FullOfSolutions)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 1); // play R2-D2
    await g.chooseNoAsync(1); // decline discard

    // No deck search — hand still has Battlefield Marine, deck still has Cell Block Guard
    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player1.hand[0].cardId).toBe(Cards.units.sor.battlefieldMarine);
    expect(g.state.player1.deck.length).toBe(1);
  });

  it("presents the deck search with dontReveal: true", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInDeckForPlayer(1, Cards.units.sor.cellBlockGuard)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.twi.r2d2FullOfSolutions)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 1);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // discard — deck search pending is now active

    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("DeckSearch");
    if (resolution?.type === "DeckSearch") {
      expect(resolution.dontReveal).toBe(true);
    }
  });

  it("is a continuation — R2-D2 enters play before the deck search fires", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6) // cost 2 + 4 aspect penalty (Cunning,Heroism not covered)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.cellBlockGuard)
      .WithCardInHandForPlayer(1, Cards.units.twi.r2d2FullOfSolutions)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 1); // play R2-D2

    // R2-D2 must be in the ground arena before any option is presented
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.r2d2FullOfSolutions)).toBe(true);

    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // discard Cell Block Guard
    await g.chooseDeckSearchAsync(1, ["0"]); // draw Battlefield Marine

    expect(g.state.player1.hand[0].cardId).toBe(Cards.units.sor.battlefieldMarine);
  });
});
