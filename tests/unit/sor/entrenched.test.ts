import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_072 Entrenched", () => {
  it("prevents the attached unit from attacking the base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.entrenched, 1),
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    const resolution = g.lastDispatchResponse?.resolutionNeeded;

    // Base must not be an eligible target — fromZones should be absent/empty
    expect(resolution?.type).toBe("Target");
    expect((resolution as { fromZones?: string[] })?.fromZones ?? []).not.toContain("Base");
  });

  it("still allows the attached unit to attack enemy units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.entrenched, 1),
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Enemy unit should be defeated (3 base power + 3 from Entrenched = 6 vs 3 HP)
    expect(g.state.player2.groundArena.find(u => u.playId === enemyPlayId)).toBeUndefined();
  });

  it("a unit without Entrenched can still attack the base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const baseDamageBefore = g.state.player2.base.damage;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBeGreaterThan(baseDamageBefore);
  });
});
