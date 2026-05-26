import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("Death Trooper tests", () => {
  it("should deal 2 damage to a friendly ground unit and 2 damage to an enemy ground unit", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.deathTrooper, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.deathTrooper)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    //expect(g.state.player1.groundArena[0].damage).toBe(0);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});