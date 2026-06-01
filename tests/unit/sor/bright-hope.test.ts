import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_099 Bright Hope — 2/6 Space (Command+Heroism), cost 4
// "Sentinel. When Played: You may return a friendly non-leader ground unit to its owner's hand. If you do, draw a card."

describe("SOR_099 Bright Hope", () => {
  it("When Played: returns a friendly non-leader ground unit to hand and draws a card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)    // Command base
      .MyLeader(Cards.leaders.sor.chewbacca)   // Vigilance+Heroism covers Command+Heroism with base
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.brightHope)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    state.player1.deck.push({ cardId: Cards.units.sor.battlefieldMarine });

    const marinePlayId = state.player1.groundArena[0].playId;
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // "Return a friendly non-leader ground unit to hand?"
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player1.hand.length).toBe(handBefore + 1); // marine returned + card drawn, -1 bright hope played = net +1
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("When Played: skips bounce and does not draw when No is chosen", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.brightHope)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena.length).toBe(1); // marine stays
    expect(g.state.player1.hand.length).toBe(handBefore - 1); // only bright hope consumed
  });

  it("When Played: auto-skips when no friendly non-leader ground units exist", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.brightHope)
      .Build();
    g.loadNewState(state);

    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0); // no prompt — no eligible targets

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand.length).toBe(handBefore - 1);
  });

  it("When Played: cannot target enemy ground units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.brightHope)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy unit only
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // No eligible targets → prompt does not appear
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
