import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_091 The Emperor's Legion (Event, cost 2, Command+Villainy)
// Return each unit in your discard pile that was defeated this phase to your hand.
//
// Flow: player 1 attacks the AT-AT (9/9) with a Marine (2/3).
// Marine takes 9 counter-damage → defeated → goes to discard.
// Player 2 passes → back to player 1.
// Emperor's Legion returns the Marine to hand.

describe("SOR_091 The Emperor's Legion", () => {
  it("returns a unit defeated this phase from discard to hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.emperorsLegion)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt)
      .Build();
    g.loadNewState(state);
    const atAtPlayId = state.player2.groundArena[0].playId;

    // Player 1 attacks with Marine into AT-AT → Marine counter-killed
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [atAtPlayId] });
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);

    // Player 2 passes so turn returns to player 1
    await g.dispatchAsync(2, "pass-action", {});

    // Player 1 plays Emperor's Legion
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
  });

  it("does not return units that were not defeated this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.emperorsLegion)
      .Build();
    g.loadNewState(state);

    // Manually add a previous-phase defeat to discard
    state.player1.discard.unshift({
      cardId: Cards.units.sor.battlefieldMarine,
      playId: "previous-phase-unit",
      owner: 1,
      controller: 1,
      turnDiscarded: 1,
      discardEffect: "",
    });

    // Player 1 plays the event directly (no combat needed)
    await g.playCardFromHandAsync(1, 0);

    // Old discard entry should remain; no cards added to hand
    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.discard.some(d => d.playId === "previous-phase-unit")).toBe(true);
  });
});
