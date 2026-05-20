import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Simple Sabtoteur Test", () => {
  it("should break all defender's shields", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.yellow30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.rebelPathfinder)
      .WithGroundUnitForPlayer(2, Cards.units.sor.craftySmuggler)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)
      ])
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.discard.length).toBe(1);
  });

  it("should bypass Sentinel", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.yellow30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.rebelPathfinder)
      .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(2);
    // assert
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(2);
  });
});