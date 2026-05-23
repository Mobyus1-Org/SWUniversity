import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { bobaDaimyoLeiaAdelphiPuzzleState } from "../../_gamestates/puzzles";
import { PuzzleInProcessTransport } from "@/lib/engine/transports/puzzle-in-process";

describe("Boba Fett Daimyo / Leia Organa Adelphi Puzzle", () => {
  it("produces only Player 1 as winner when simple puzzle is completed", async () => {
    // arrange
    const g = new GameTestAdapter(true, (game) => new PuzzleInProcessTransport(game));
    g.loadNewState(bobaDaimyoLeiaAdelphiPuzzleState);
    // act
    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 2);
    // trigger-order prompt: Ambush fires first, then Boba Fett
    await g.chooseOptionAsync(1, "Battlefield Marine — Ambush");
    await g.chooseNoAsync(1); // decline ambush attack
    // Boba Fett leader reaction: exhaust leader, buff a unit +1/+0 this phase
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(1, 0); // buff Adelphi Patrol Wing (+1/+0)
    // play Attack Pattern Delta: Adelphi +3/+3, EBD +2/+2, BFM +1/+1
    await g.playCardFromHandAsync(1, 2);
    await g.chooseSpaceUnitAsync(1, 0);   // Adelphi: +3/+3 (total power 4+1+3=8)
    await g.chooseGroundUnitAsync(1, 0);  // EBD: +2/+2
    await g.chooseGroundUnitAsync(1, 1);  // BFM: +1/+1
    // Adelphi (8 power) attacks P2 base — deals exactly 8 damage (22→30)
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    // assert
    expect(g.state.player1.base.damage).toBe(24);
    expect(g.state.player2.base.damage).toBe(30);
    expect(g.state.defeatedPlayers).toEqual([2]);
  });
});