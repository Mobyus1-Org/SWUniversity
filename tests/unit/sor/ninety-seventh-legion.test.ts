import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SOR_118 97th Legion — 0/0 Ground (Command)
// This unit gets +1/+1 for each resource you control.

describe("SOR_118 97th Legion", () => {
  it("power equals resource count (4 resources → 4 damage to base)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithGroundUnitForPlayer(1, Cards.units.sor.ninetySeventhLegion)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"], targetPlayers: [2] });

    expect(g.state.player2.base.damage).toBe(4);
  });

  it("HP equals resource count (3 resources → TotalHP 3)", () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithGroundUnitForPlayer(1, Cards.units.sor.ninetySeventhLegion)
      .Build();
    g.loadNewState(state);

    const legionData = state.player1.groundArena[0];
    const legion = Unit.FromInterface(legionData);
    expect(legion.TotalHP()).toBe(3);
    expect(legion.CurrentHP()).toBe(3);
  });
});
