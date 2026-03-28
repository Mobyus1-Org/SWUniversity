import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Simple On Attack", () => {
  it("should deal 2 damage to a unit when Darth Vader's ability is triggered", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
      ])
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(2);
    await g.chooseYesAsync(1); // choose to trigger Darth Vader's "On Attack: You may deal 2 damage to a unit."
    await g.chooseSpaceUnitAsync(2, 0); // choose to deal damage to opponent's X-Wing
    // assert
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player2.spaceArena[0].damage).toBe(2);
  });

  it("should not trigger Darth Vader's ability when user chooses not to trigger it", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
      ])
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(2);
    await g.chooseNoAsync(1);
    // assert
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });

  it("should ping the base when Sabine leader attacks", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.sabineWren)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(2);
    // assert
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(3);
  });
});