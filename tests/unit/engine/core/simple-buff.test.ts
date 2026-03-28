import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { Unit } from "@/server/engine/unit";

describe("Simple buff", () => {
  it("givess +2 stats for two Experience tokens", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
      ])
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(2);
    // assert
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("survives attack due to Experience token hp", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    const res = Unit.FromInterface(g.state.player1.groundArena[0]);
    // assert
    expect(res.CurrentHP()).toBe(1);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena.length).toBe(0);
  });
});