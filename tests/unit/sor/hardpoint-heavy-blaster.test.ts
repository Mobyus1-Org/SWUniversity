import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_121 Hardpoint Heavy Blaster", () => {
  it("On Attack: prompts to deal 2 damage to a unit in the defender's arena when attacking a unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // Vehicle
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.hardpointHeavyBlaster, 1),
      ])
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const enemy0 = state.player2.spaceArena[0].playId;
    const enemy1 = state.player2.spaceArena[1].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy0] });

    // On Attack fires: choose Yes
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    // Choose a unit in the defender's arena to take 2 damage
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy1] });

    expect(g.state.player2.spaceArena.find(u => u.playId === enemy1)?.damage).toBe(2);
  });

  it("On Attack: does not fire when attacking a base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.hardpointHeavyBlaster, 1),
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // No On Attack prompt — goes straight to state update
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBeGreaterThan(0);
  });

  it("On Attack: player may decline — no damage dealt", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.hardpointHeavyBlaster, 1),
      ])
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const enemy0 = state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy0] });
    await g.chooseNoAsync(1); // Decline On Attack

    // No extra damage beyond combat
    const damageTakenInCombat = g.state.player2.spaceArena[0]?.damage ?? 0;
    expect(damageTakenInCombat).toBeLessThanOrEqual(2); // only combat damage
  });

  it("attaches only to Vehicle units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // NOT a Vehicle
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)  // Vehicle
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.hardpointHeavyBlaster)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // Play Hardpoint Heavy Blaster

    // Upgrade target prompt: only the Vehicle should be eligible
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    const marinePlayId = state.player1.groundArena[0].playId;
    const patrolPlayId = state.player1.spaceArena[0].playId;
    expect(resolution?.type === "Target" && resolution.fromPlayIds?.includes(marinePlayId)).toBe(false);
    expect(resolution?.type === "Target" && resolution.fromPlayIds?.includes(patrolPlayId)).toBe(true);
  });
});
