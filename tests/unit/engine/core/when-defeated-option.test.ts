import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { NeedsOption } from "@/lib/engine/message-types";

describe("When defeated options for K-2SO", () => {
  it("should deal 3 damage to the base when K-2SO is defeated", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.k2so)
      .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    const lastDispatch = g.lastDispatchResponse!.resolutionNeeded as NeedsOption;
    expect(lastDispatch.options).toEqual(["deal_base_damage=2,3", "player_discards_from_hand=2,1"]);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3"); // option format is "deal_base_damage=targetPlayerId,damageAmount"
    // assert
    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("should make opponent discard from hand when K-2SO is defeated", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.k2so)
      .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "player_discards_from_hand=2,1"); // option format is "player_discards_from_hand=targetPlayerId,numCardsToDiscard"
    await g.chooseCardFromHandAsync(2, 1); // opponent discards second card
    // assert
    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.player2.hand.length).toBe(1);
  });
});