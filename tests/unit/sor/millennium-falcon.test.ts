import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_193 — Millennium Falcon (3/4 Space, Cunning+Heroism, cost 3)
// "This unit enters play ready.
// When you ready cards during the regroup phase: Either pay [1 resource] or return this unit to her owner's hand."

describe("SOR_193 — Millennium Falcon", () => {
  it("enters play ready", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.millenniumFalconSor)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    const mf = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.millenniumFalconSor);
    expect(mf).toBeDefined();
    expect(mf?.ready).toBe(true);
  });

  it("prompts to pay 1 resource or return to hand during regroup", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGamePhase("RegroupResource")
      .WithSpaceUnitForPlayer(1, Cards.units.sor.millenniumFalconSor)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 1)
      .Build();
    g.loadNewState(state);

    // Both players pass their resource steps to trigger regroup ready
    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("stays in play when player pays 1 resource", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGamePhase("RegroupResource")
      .WithSpaceUnitForPlayer(1, Cards.units.sor.millenniumFalconSor)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 1)
      .Build();
    g.loadNewState(state);

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);
    await g.chooseYesAsync(1); // Pay 1 resource

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sor.millenniumFalconSor)).toBe(true);
    // One resource should have been exhausted from the readied resources
    const exhaustedCount = g.state.player1.resources.filter(r => !r.ready).length;
    expect(exhaustedCount).toBe(1);
  });

  it("returns to hand when player declines to pay", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGamePhase("RegroupResource")
      .WithSpaceUnitForPlayer(1, Cards.units.sor.millenniumFalconSor)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 1)
      .Build();
    g.loadNewState(state);

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);
    await g.chooseNoAsync(1); // Return to hand

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sor.millenniumFalconSor)).toBe(false);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.millenniumFalconSor)).toBe(true);
  });
});
