import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_035 Lieutenant Childsen — 3/5 Ground (Vigilance/Villainy), cost 4
// Sentinel. When Played: Reveal up to 4 [Vigilance] cards from your hand. For each card revealed, give an Experience token to this unit.

describe("SOR_035 Lieutenant Childsen", () => {
  it("prompts to reveal Vigilance hand cards when at least one is present", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lieutenantChildsen)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke) // index 1 — Vigilance
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" && res.fromZones).toContain("Hand");
    expect(res?.type === "Target" && res.needsMultiple).toBe(true);
    expect(res?.type === "Target" && res.maxTargets).toBe(4);
    // Only index 1 (lomPyke) is eligible — index 0 (Childsen) was played and left hand
    expect(res?.type === "Target" && res.fromIndices).toEqual([0]); // 0 = lomPyke after childsen leaves
  });

  it("gives 1 XP when player reveals 1 Vigilance card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lieutenantChildsen)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke) // index 1
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.revealFromHandAsync(1, [0]); // lomPyke is now index 0 after childsen leaves hand

    const childsen = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.lieutenantChildsen);
    expect(childsen?.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("gives 0 XP when player reveals nothing", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lieutenantChildsen)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.revealFromHandAsync(1, []); // choose to reveal nothing

    const childsen = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.lieutenantChildsen);
    expect(childsen?.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(0);
  });

  it("caps XP at 4 even when more than 4 Vigilance cards are in hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lieutenantChildsen)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke) // indices 0-4 after childsen leaves
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.revealFromHandAsync(1, [0, 1, 2, 3, 4]); // 5 eligible but capped at 4

    const childsen = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.lieutenantChildsen);
    expect(childsen?.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(4);
  });

  it("no prompt when no Vigilance cards in hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lieutenantChildsen)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // Command/Heroism — not Vigilance
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    const childsen = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.lieutenantChildsen);
    expect(childsen?.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(0);
  });
});
