import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Simple Ambush Test", () => {
  it("should enter play with choice to Ambush when played from hand", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.syndicateLackeys)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.sor.syndicateLackeys);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena.length).toBe(1);
    expect(g.state.player2.discard.length).toBe(1);
  });

  it("should remain exhausted when No is chosen for Ambush", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.syndicateLackeys)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);
    // assert
    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.sor.syndicateLackeys);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena.length).toBe(2);
    expect(g.state.player2.discard.length).toBe(0);
  });

  it("should not prompt to resolve Ambush if no units are available to attack", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.syndicateLackeys)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    const lastDispatch = g.lastDispatchResponse?.resolutionNeeded;
    // assert
    expect(lastDispatch).toBe(undefined);
  });
});