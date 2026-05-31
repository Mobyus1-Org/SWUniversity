import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_081 Seasoned Shoretrooper — 2/3 Ground (Command+Villainy)
// While you control 6 or more resources, this unit gets +2/+0.

describe("SOR_081 Seasoned Shoretrooper", () => {
  it("base power 2 with fewer than 6 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.seasonedShoretrooper)
      .Build();
    g.loadNewState(state);

    // Attack opponent's base — damage equals power
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"], targetPlayers: [2] });

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("power increases to 4 with 6 or more resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithGroundUnitForPlayer(1, Cards.units.sor.seasonedShoretrooper)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"], targetPlayers: [2] });

    expect(g.state.player2.base.damage).toBe(4);
  });
});
