import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_056 — Bendu (Unit, Vigilance×Vigilance, cost 6, Sentinel, 4/7, Force/Creature)
// "Sentinel
//  On Attack: The next non-[Heroism], non-[Villainy] card you play this phase
//  costs [2 resources] less."
//
// [Heroism]/[Villainy] refers to card aspect icons.
// System Patrol Craft (SOR_066) has Vigilance (neutral) → gets discount.

describe("SOR_056 — Bendu On Attack", () => {
  it("pushes a Phase SOR_056 effect onto the controller's currentEffects when Bendu attacks", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.bendu)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    expect(g.state.currentEffects.some(
      e => e.cardId === "SOR_056" && e.affectedPlayer === 1,
    )).toBe(true);
  });
});

describe("SOR_056 — Bendu discount applied to card play", () => {
  it("reduces cost of a neutral card by 2 (SPC costs 4, effective 2 with discount)", async () => {
    // System Patrol Craft (SOR_066): Vigilance, cost 4, Space arena, Sentinel.
    // With Bendu discount: 4-2=2. Player has exactly 2 resources → can only play with discount.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft) // SOR_066, Vigilance, cost 4, Space
      .Build();
    g.loadNewState(state);
    state.currentEffects.push({ cardId: "SOR_056", duration: "Phase", affectedPlayer: 1 });

    await g.playCardFromHandAsync(1, 0);

    // SPC is in the Space arena (it's a space unit).
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sor.systemPatrolCraft)).toBe(true);
    // Discount consumed.
    expect(g.state.currentEffects.some(e => e.cardId === "SOR_056")).toBe(false);
  });

  it("does NOT reduce cost of Heroism-aspect cards", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.bailOrgana) // Command+Heroism
      .Build();
    g.loadNewState(state);
    state.currentEffects.push({ cardId: "SOR_056", duration: "Phase", affectedPlayer: 1 });

    await g.playCardFromHandAsync(1, 0);

    // Heroism card: discount NOT consumed.
    expect(g.state.currentEffects.some(e => e.cardId === "SOR_056")).toBe(true);
  });

  it("does NOT reduce cost of Villainy-aspect cards", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.units.sor.deathStarStormtrooper) // Aggression+Villainy
      .Build();
    g.loadNewState(state);
    state.currentEffects.push({ cardId: "SOR_056", duration: "Phase", affectedPlayer: 1 });

    await g.playCardFromHandAsync(1, 0);

    // Villainy card: discount NOT consumed.
    expect(g.state.currentEffects.some(e => e.cardId === "SOR_056")).toBe(true);
  });

  it("discount applies to only the first qualifying card (effect consumed, only 2 resources spent)", async () => {
    // SPC costs 4 normally. With Bendu discount: 2 effective cost.
    // After playing, 6-2=4 resources remain (not 6-4=2 which would indicate no discount).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);
    state.currentEffects.push({ cardId: "SOR_056", duration: "Phase", affectedPlayer: 1 });

    // Play SPC: costs 2 (discounted from 4). 6-2=4 resources remain.
    await g.playCardFromHandAsync(1, 0);

    // Discount consumed.
    expect(g.state.currentEffects.some(e => e.cardId === "SOR_056")).toBe(false);
    // Only 2 resources were spent (discount applied), so 4 should remain.
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(4);
  });
});
