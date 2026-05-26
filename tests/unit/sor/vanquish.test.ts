import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("Vanquish tests", () => {
  it("should defeat a non-leader unit", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("should behave the same with reprint", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.twi.vanquish)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player2.groundArena.length).toBe(0);
  });
});