import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_199 — Bamboozle (Event, 2-cost, Cunning/Heroism, Trick)
// "You may discard a [Cunning] card from your hand instead of paying this event's cost.
// Exhaust a unit and return each upgrade on it to its owner's hand."

describe("SOR_199 — Bamboozle", () => {
  // ---------------------------------------------------------------------------
  // Cost / Playability
  // ---------------------------------------------------------------------------

  it("is playable with enough resources (normal cost)", async () => {
    // Han Solo provides Cunning+Heroism, covering both of Bamboozle's aspects (no penalty → cost = 2).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .Build();
    g.loadNewState(state);

    // 2 resources, no other Cunning card in hand → pays normally, asks for a unit target
    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("is playable via alternate cost when player has a Cunning card but no resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      // No resources readied
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .WithCardInHandForPlayer(1, Cards.events.sor.shootFirst) // Cunning card for alt cost
      .Build();
    g.loadNewState(state);

    // Should ask yes/no for alternate cost instead of blocking as unplayable
    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("shows yes/no prompt when both normal and alternate cost are available", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .WithCardInHandForPlayer(1, Cards.events.sor.shootFirst) // Cunning card for alt cost
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("is not playable without resources AND without a Cunning card in hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      // No resources, no other Cunning card
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Alternate cost flow: choose "Yes" (discard a Cunning card)
  // ---------------------------------------------------------------------------

  it("when alternate cost is chosen: prompts to pick a Cunning card from hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .WithCardInHandForPlayer(1, Cards.events.sor.shootFirst) // Cunning card at hand[0] after Bamboozle removed
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Yes = use alternate cost

    // Should now ask for a hand target (Cunning card to discard)
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const resolution = g.lastDispatchResponse?.resolutionNeeded as { type: string; fromZones?: string[] };
    expect(resolution.fromZones).toContain("Hand");
  });

  it("alternate cost: discards the chosen Cunning card and exhausts no resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .WithCardInHandForPlayer(1, Cards.events.sor.shootFirst) // Cunning card at hand[0] after Bamboozle removed
      .Build();
    g.loadNewState(state);
    const enemyMarinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);   // play Bamboozle (now at hand index 0; ShootFirst shifts to hand[0])
    await g.chooseYesAsync(1);             // use alternate cost
    await g.chooseCardFromHandAsync(1, 0); // discard ShootFirst (the only remaining hand card)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] }); // target unit

    // All resources should still be ready (alternate cost paid via discard)
    const readyCount = g.state.player1.resources.filter(r => r.ready).length;
    expect(readyCount).toBe(2);
    // ShootFirst should no longer be in hand (was discarded as alternate cost)
    expect(g.state.player1.hand.some(c => c.cardId === Cards.events.sor.shootFirst)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Normal cost flow: choose "No" (pay resources)
  // ---------------------------------------------------------------------------

  it("when normal cost is chosen: exhausts resources and does not discard", async () => {
    // Han Solo provides Cunning+Heroism → cost = 2 (no aspect penalty).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .WithCardInHandForPlayer(1, Cards.events.sor.shootFirst)
      .Build();
    g.loadNewState(state);
    const enemyMarinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);  // play Bamboozle
    await g.chooseNoAsync(1);             // pay normally
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] }); // target unit

    // Resources were exhausted (2 ready → 0 ready)
    const readyCount = g.state.player1.resources.filter(r => r.ready).length;
    expect(readyCount).toBe(0);
    // ShootFirst stays in hand
    expect(g.state.player1.hand.some(c => c.cardId === Cards.events.sor.shootFirst)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Effect: exhaust unit + return upgrades to hand
  // ---------------------------------------------------------------------------

  it("exhausts the targeted unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .Build();
    g.loadNewState(state);
    const enemyMarinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] });

    const targetUnit = g.state.player2.groundArena.find(u => u.playId === enemyMarinePlayId);
    expect(targetUnit?.ready).toBe(false);
  });

  it("returns a non-token upgrade on the target to its owner's hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.entrenched, 2),
      ])
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .Build();
    g.loadNewState(state);
    const enemyMarinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] });

    // Entrenched should be returned to player 2's hand
    expect(g.state.player2.hand.some(c => c.cardId === Cards.upgrades.sor.entrenched)).toBe(true);
    // And removed from the unit
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("defeats shield tokens on the target unit rather than returning to hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade("SOR_T02", 2), // Shield token
      ])
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .Build();
    g.loadNewState(state);
    const enemyMarinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] });

    // Shield token defeated (not in hand, not on unit)
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.hand.some(c => c.cardId === "SOR_T02")).toBe(false);
  });

  it("returns upgrades owned by different players to their respective hands", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.entrenched, 2),
      ])
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.bamboozle)
      .Build();
    g.loadNewState(state);
    const enemyMarinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] });

    // Entrenched owned by player 2 → goes to player 2's hand
    expect(g.state.player2.hand.some(c => c.cardId === Cards.upgrades.sor.entrenched)).toBe(true);
    // Player 1's hand should not have it
    expect(g.state.player1.hand.some(c => c.cardId === Cards.upgrades.sor.entrenched)).toBe(false);
  });
});
