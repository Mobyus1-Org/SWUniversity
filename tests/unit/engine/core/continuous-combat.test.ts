import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Attack with multiple units", () => {
  it("should attack with multiple units with Rebel Assault", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.rebelAssault)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);
    // assert
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(8);
  });

  it("should only allow one Rebel to attack with Rebel Assault", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.rebelAssault)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.shd.recklessGunslinger)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2)
    await g.chooseGroundUnitAsync(1, 1); //should be a no-op
    await g.chooseBaseAsync(1, 2); //should be a no-op
    // assert
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("should attack with three units if Leia is picked last", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.rebelAssault)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.leiaOrgana)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2)
    await g.chooseGroundUnitAsync(1, 2);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);
    // assert
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(12);
  });
});