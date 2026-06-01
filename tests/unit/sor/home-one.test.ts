import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_102 Home One — 7/7 Space (Command+Heroism), cost 8
// "Restore 2. Each other friendly unit gains Restore 1.
//  When Played: Play a [Heroism] unit from your discard pile. It costs [3 resources] less."
//
// Pre-filter: only Heroism units affordable at (playCost - 3) appear in the prompt.
// Aspect penalty is NOT waived — only the flat -3 reduction applies.

describe("SOR_102 Home One", () => {
  it("When Played: plays a Heroism unit from discard at cost -3", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)     // Command base
      .MyLeader(Cards.leaders.sor.chewbacca)    // Vigilance+Heroism — covers Command+Heroism with base
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12) // 8 for Home One + 1 for echoBaseDefender (cost 3 - 3 = 0)
      .WithCardInHandForPlayer(1, Cards.units.sor.homeOne)
      .Build();
    g.loadNewState(state);

    // echoBaseDefender: Command+Heroism, base cost 3 → covered aspects → effective cost 0
    state.player1.discard.push({ cardId: Cards.units.sor.echoBaseDefender, playId: "9001", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // "Play a Heroism unit from discard?"
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["9001"] });

    expect(g.state.player1.discard.length).toBe(0);
    // echoBaseDefender (Ground) should now be in play
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.echoBaseDefender)).toBe(true);
  });

  it("When Played: skipping leaves discard and resources unchanged", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 9)
      .WithCardInHandForPlayer(1, Cards.units.sor.homeOne)
      .Build();
    g.loadNewState(state);

    state.player1.discard.push({ cardId: Cards.units.sor.echoBaseDefender, playId: "9001", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    const resourcesBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.playCardFromHandAsync(1, 0);
    const resourcesAfterHomeOne = g.state.player1.resources.filter(r => r.ready).length;
    await g.chooseNoAsync(1);

    expect(g.state.player1.discard.length).toBe(1); // still in discard
    // No extra resources spent beyond Home One's cost
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(resourcesAfterHomeOne);
  });

  it("When Played: auto-skips when no Heroism units in discard", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 9)
      .WithCardInHandForPlayer(1, Cards.units.sor.homeOne)
      .Build();
    g.loadNewState(state);

    // Only a non-Heroism unit in discard (reinforcementWalker is Command only, no Heroism)
    state.player1.discard.push({ cardId: Cards.units.sor.reinforcementWalker, playId: "9001", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.discard.length).toBe(1); // untouched
  });

  it("When Played: aspect penalty applies — Kallus (Villainy) pays penalty for Heroism unit", async () => {
    const g = new GameTestAdapter();
    // Kallus: Vigilance+Villainy. blue30HP base: Vigilance.
    // Provided: Vigilance×2 + Villainy. Home One (Command+Heroism): both missing → penalty +4 → cost 8+4=12.
    // echoBaseDefender (Command+Heroism, cost 3): both missing → penalty +4 → playCost 7 → effective 4.
    // Give 16 resources: pay 12 for Home One → 4 left → echoBaseDefender (effective 4) is exactly affordable.
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)      // Vigilance
      .MyLeader(Cards.leaders.law.agentKallus)  // Vigilance+Villainy
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
      .WithCardInHandForPlayer(1, Cards.units.sor.homeOne)
      .Build();
    g.loadNewState(state);

    state.player1.discard.push({ cardId: Cards.units.sor.echoBaseDefender, playId: "9001", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    await g.playCardFromHandAsync(1, 0);
    // Prompt appears because echoBaseDefender (effective cost 4) is affordable with 4 remaining resources
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["9001"] });

    expect(g.state.player1.discard.length).toBe(0);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.echoBaseDefender)).toBe(true);
    // All 16 resources exhausted: 12 for Home One + 4 for echoBaseDefender
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0);
  });

  it("When Played: Heroism unit filtered out when unaffordable at -3 (Kallus, tight resources)", async () => {
    const g = new GameTestAdapter();
    // Same Kallus setup but only 15 resources: 12 for Home One → 3 left.
    // echoBaseDefender effective cost = 4 → 3 < 4 → filtered → no prompt.
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.law.agentKallus)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 15)
      .WithCardInHandForPlayer(1, Cards.units.sor.homeOne)
      .Build();
    g.loadNewState(state);

    state.player1.discard.push({ cardId: Cards.units.sor.echoBaseDefender, playId: "9001", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    await g.playCardFromHandAsync(1, 0);

    // echoBaseDefender was pre-filtered (3 ready < 4 needed) → no prompt
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("passive: each other friendly unit gains Restore 1 while Home One is in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.homeOne)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    state.player1.base.damage = 10;
    const marinePlayId = state.player1.groundArena[0].playId;

    // Attack with Battlefield Marine — it should restore 1 (from Home One's passive)
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(9); // 10 - 1 restore
  });
});
