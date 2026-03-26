import { describe } from "node:test";
import { expect, it } from "vitest";
import { sabineWrenCadBaneSimplePuzzleState } from "./_gamestates/simple";
import { GameTestAdapter } from "./game-test-adapter";

describe("Sabine Wren / Cad Bane Simple Puzzle", () => {
  it("produces only Player 1 as winner when simple puzzle is completed", () => {
    // arrange
    const g = GameTestAdapter.fromRaw(sabineWrenCadBaneSimplePuzzleState);
    // act
    g
      .playCardFromHand(1).chooseGroundUnit(1).chooseTheirBase()
      .chooseMyLeader().sendPrompt("ability").chooseMyLeader()
      .playCardFromHand(0).chooseGroundUnit(0, 2)
      .playCardFromHand(0).chooseGroundUnit(0).chooseGroundUnit(0, 2).chooseGroundUnit(1).chooseTheirBase()
      ;
    // assert
    expect(g.game.player1.base.damage).toBe(24);
    expect(g.game.player2.base.damage).toBe(25);
    expect(g.game.defeatedPlayers).toEqual([2]);
  });

  it("produces same result with different order of actions", () => {
    // arrange
    const g = GameTestAdapter.fromRaw(sabineWrenCadBaneSimplePuzzleState);
    // act
    g
      .playCardFromHand(1).chooseGroundUnit(1).chooseTheirBase()
      .chooseMyLeader().sendPrompt("ability")
      .playCardFromHand(0).chooseGroundUnit(0, 2)
      .chooseMyLeader()
      .playCardFromHand(0).chooseGroundUnit(0).chooseGroundUnit(0, 2).chooseGroundUnit(1).chooseTheirBase()
      ;
    // assert
    expect(g.game.player1.base.damage).toBe(24);
    expect(g.game.player2.base.damage).toBe(25);
    expect(g.game.defeatedPlayers).toEqual([2]);
  });
});