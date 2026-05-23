import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { sabineWrenCadBaneSimplePuzzleState } from "../../_gamestates/puzzles";

describe("Simple Leader Test", () => {
  it("behaves correctly when using leader ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(sabineWrenCadBaneSimplePuzzleState);
    await g.useLeaderAbilityAsync(1);
    expect(g.state.player2.base.damage).toBe(12);
    expect(g.state.player1.base.damage).toBe(24);
  });
});