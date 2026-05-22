import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Turn per action validation", () => {
  it("rejects a top-level action from the non-active player", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.upgrades.sor.academyTraining, 2)
      .FillResourcesForPlayer(2, Cards.upgrades.sor.academyTraining, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.hand.length).toBe(1); //was never actually played since not active
    expect(g.state.player1.groundArena.length).toBe(1); //pre-existing ground unit
    await g.playCardFromHandAsync(2, 0);
    expect(g.state.player2.hand.length).toBe(0); //was played since Player 2 was active
    expect(g.state.player2.groundArena.length).toBe(1);
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.hand.length).toBe(0); //was played since Player 1 was active
    expect(g.state.player1.groundArena.length).toBe(2);
    // assert
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(3);
  });
});