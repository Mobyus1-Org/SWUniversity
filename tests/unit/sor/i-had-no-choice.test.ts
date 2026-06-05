import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_187 I Had No Choice — Cost 7, Cunning+Villainy Event, Trick
// Choose up to 2 non-leader units. An opponent chooses 1 of those units.
// Return that unit to its owner's hand; put the other on the bottom of its owner's deck.

describe("SOR_187 I Had No Choice", () => {
  it("with 2 units chosen: opponent picks one to return to hand, other goes to deck bottom", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett) // Cunning+Villainy
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.events.sor.iHadNoChoice)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // friendly unit A
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // enemy unit B
      .Build();
    g.loadNewState(state);

    const unitAPlayId = state.player1.groundArena[0].playId;
    const unitBPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    // Player 1 picks both units
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [unitAPlayId, unitBPlayId] });
    // Opponent (player 2) picks unit B to return to hand
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [unitBPlayId] });

    // Unit B returned to player 2's hand
    expect(g.state.player2.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    // Unit A on bottom of player 1's deck
    expect(g.state.player1.deck.length).toBe(1);
    expect(g.state.player1.deck[0].cardId).toBe(Cards.units.sor.battlefieldMarine);
    // Neither unit remains in any arena
    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("with 1 unit chosen: that unit is returned to its owner's hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.events.sor.iHadNoChoice)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const unitPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    // Player 1 picks only 1 unit
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [unitPlayId] });

    expect(g.state.player2.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("opponent cannot pick a unit not in the chosen set", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.events.sor.iHadNoChoice)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)  // not in chosen set
      .Build();
    g.loadNewState(state);

    const unitAPlayId = state.player1.groundArena[0].playId;
    const unitBPlayId = state.player2.groundArena[0].playId;
    const unitCPlayId = state.player2.groundArena[1].playId; // not chosen

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [unitAPlayId, unitBPlayId] });
    // Opponent tries to pick unit C (not in chosen set) — should be invalid
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [unitCPlayId] });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
