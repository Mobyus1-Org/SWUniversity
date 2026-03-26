import { describe } from "node:test";
import { expect, it } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/puzzle/game-state-builder";
import { Cards } from "../../card-helpers";

describe("Overwhelm", () => {
  it("deals excess damage to the opponent's base", () => {
    // arrange
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefiieldMarine)
      .Build()
    ;
    const g = GameTestAdapter.fromRaw(s);
    // act
    g
      .chooseGroundUnit(0).chooseGroundUnit(0, 2);
      ;
    // assert
    expect(g.game.player2.groundArena.length).toBe(0);
    expect(g.game.player1.groundArena[0].damage).toBe(3);
    expect(g.game.player1.base.damage).toBe(0);
    expect(g.game.player2.base.damage).toBe(1);
  });
});