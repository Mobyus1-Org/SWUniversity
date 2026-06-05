import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_214 Smuggling Compartment (Upgrade) — Attach to a VEHICLE unit.
// Attached unit gains: 'On Attack: Ready a resource.'

describe("SOR_214 Smuggling Compartment", () => {
  it("attaches only to Vehicle units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // NOT a Vehicle
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)    // Vehicle
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.smugglingCompartment)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    const marinePlayId = state.player1.groundArena[0].playId;
    const patrolPlayId = state.player1.spaceArena[0].playId;
    expect(resolution?.type === "Target" && resolution.fromPlayIds?.includes(marinePlayId)).toBe(false);
    expect(resolution?.type === "Target" && resolution.fromPlayIds?.includes(patrolPlayId)).toBe(true);
  });

  it("On Attack: readies one exhausted resource", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.smugglingCompartment, 1),
      ])
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .Build();
    g.loadNewState(state);

    // Exhaust all resources manually
    state.player1.resources.forEach(r => (r.ready = false));
    g.loadNewState(state);

    const enemy = state.player2.spaceArena[0].playId;
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] });

    // One resource should now be ready
    const readyCount = g.state.player1.resources.filter(r => r.ready).length;
    expect(readyCount).toBe(1);
  });

  it("On Attack: does nothing when all resources are already ready", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.smugglingCompartment, 1),
      ])
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .Build();
    g.loadNewState(state);
    // All resources are already ready (default)

    const enemy = state.player2.spaceArena[0].playId;
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] });

    // All resources remain ready (no change)
    const readyCount = g.state.player1.resources.filter(r => r.ready).length;
    expect(readyCount).toBe(2);
  });
});
