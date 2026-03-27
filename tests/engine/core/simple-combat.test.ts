import { describe, it, expect } from "vitest";

import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";


describe("Simple Combat", () => {
  it("produces the correct base damage values", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefiieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefiieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(2);
    // assert
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(3);
   });

   it("defeats both units when they fight", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefiieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefiieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
   });
});

describe("Simple Combat with Sentinels", () => {
  it("sentinel blocks damage to base", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefiieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    const res = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    // assert
    expect(res.fromZones).toBeUndefined();
    expect(res.fromPlayIds![0]).toBe(s.player2.groundArena[0].playId);
   });

    it("Saboteur bypasses Sentinel", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.fightersForFreedom)
      .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [

      ])
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    const res = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    // assert
    expect(res.fromZones?.length).toBe(1);
    expect(res.fromZones![0]).toBe("Base");
    expect(res.fromPlayIds![0]).toBe(s.player2.groundArena[0].playId);
   });
});