import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { Unit } from "@/server/engine/unit";

describe("Simple Raid Test", () => {
  it("should get boost on attack with Raid 1", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.leiaOrgana)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(2);
    const res = g.state.player1.groundArena[0];
    // assert
    expect(Unit.FromInterface(res).CurrentPower()).toBe(3);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("should get boost on attack with Raid 3 and boost from Krennic from damage", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.directorKrennic)
      .WithSpaceUnitForPlayer(1, Cards.units.lof.strikeship, true, 1)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(2);
    const res = g.state.player1.spaceArena[0];
    // assert
    expect(Unit.FromInterface(res).CurrentPower()).toBe(1);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });
});