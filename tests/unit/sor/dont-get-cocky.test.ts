import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_223 — Don't Get Cocky (Event, 4-cost, Cunning, Gambit)
// "Choose a unit. One at a time, reveal cards from your deck until you choose to stop
// or have revealed 7 cards. If the combined cost of the revealed cards is 7 or less,
// deal that much damage to the chosen unit. Put the revealed cards on the bottom of
// your deck in a random order."

describe("SOR_223 — Don't Get Cocky", () => {
  it("asks for a target unit after being played", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.dontGetCocky)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("shows reveal prompt (DontGetCocky resolution) after target is chosen", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.dontGetCocky)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("DontGetCocky");
  });

  it("deals damage equal to total cost when stopping within 7 and total ≤ 7", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 9 HP, tanky target
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.dontGetCocky)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 (bottom)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 (top)
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] }); // First card auto-revealed
    // Revealed 1 card (cost 2). Total = 2. Choose Stop.
    await g.dispatchAsync(1, "choose-option", { option: "Stop" });

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId);
    expect(target?.damage).toBe(2); // cost 2 dealt as damage
  });

  it("deals no damage when total cost exceeds 7 after reveals", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.dontGetCocky)
      .WithCardInDeckForPlayer(1, Cards.units.sor.devastator) // cost 9 (top of deck)
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] }); // Reveals devastator (cost 9)
    // Auto-stops or player stops — total cost 9 > 7, no damage
    await g.dispatchAsync(1, "choose-option", { option: "Stop" });

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId);
    expect(target?.damage).toBe(0); // no damage since cost > 7
  });

  it("puts revealed cards on the bottom of deck", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.dontGetCocky)
      .WithCardInDeckForPlayer(1, Cards.units.sor.reinforcementWalker) // bottom of deck
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)   // top of deck (revealed first)
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;
    const deckSizeBefore = 2;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] }); // reveals marine
    await g.dispatchAsync(1, "choose-option", { option: "Stop" }); // stop with 1 card revealed

    // Marine should be back in deck (at bottom), reinforcement walker still in deck
    expect(g.state.player1.deck).toHaveLength(deckSizeBefore); // both cards back in deck
    expect(g.state.player1.deck.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });
});
