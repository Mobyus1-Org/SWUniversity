import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";

// SOR_113 Homestead Militia — 3/4 Ground (Command)
// While you control 6 or more resources, this unit gains Sentinel.
//
// Player 2 is active; they attack into player 1's Militia.
// Player 1's resource count determines whether Sentinel fires.

describe("SOR_113 Homestead Militia", () => {
  it("no Sentinel with fewer than 6 resources — base is a valid attack target", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.homesteadMilitia)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(2, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as NeedsTarget;

    // No Sentinel — zones (base) should be offered alongside unit targets
    expect(res.fromZones).toBeDefined();
  });

  it("gains Sentinel with 6+ resources — only Sentinel unit can be attacked", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithGroundUnitForPlayer(1, Cards.units.sor.homesteadMilitia)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    const militiaPlayId = state.player1.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(2, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as NeedsTarget;

    // Sentinel active — only the Militia is a valid target, base not offered
    expect(res.fromZones).toBeUndefined();
    expect(res.fromPlayIds).toEqual([militiaPlayId]);
  });
});
