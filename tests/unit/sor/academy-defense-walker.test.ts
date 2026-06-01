import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_037 Academy Defense Walker — 3/5 Ground (Villainy), cost 3
// Sentinel. When Played: Give an Experience token to each friendly damaged unit.

describe("SOR_037 Academy Defense Walker", () => {
  it("gives XP to each friendly damaged unit when played", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)     // Vigilance base
      .MyLeader(Cards.leaders.sor.idenVersio)  // Vigilance+Villainy — covers both aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.academyDefenseWalker)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 1) // damaged
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // damaged
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T01")).toBe(true);
    expect(g.state.player1.groundArena[1].upgrades.some(u => u.cardId === "SOR_T01")).toBe(true);
  });

  it("does not give XP to undamaged units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.academyDefenseWalker)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // undamaged
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T01")).toBe(false);
  });

  it("does nothing when no friendly units are in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.academyDefenseWalker)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
