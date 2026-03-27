import { describe } from "node:test";
import { expect, it } from "vitest";
import { sabineWrenCadBaneSimplePuzzleState } from "../_gamestates/simple";
import { GameTestAdapter } from "../game-test-adapter";

describe("Sabine Wren / Cad Bane Simple Puzzle", () => {
  it("produces only Player 1 as winner when simple puzzle is completed", async () => {
    // arrange
    const g = new GameTestAdapter();
    g.loadNewState(sabineWrenCadBaneSimplePuzzleState);
    // act
    await g.playCardFromHandAsync(1, 1);            // play Precision Fire event
    await g.chooseGroundUnitAsync(1, 1);            // choose Reckless Gunslinger (now has Saboteur)
    await g.chooseBaseAsync(2);                     // attack opponent base
    await g.useLeaderAbilityAsync(1);               // use Sabine's leader ability
    await g.deployLeaderAsync(1);                   // deploy Sabine
    await g.playCardFromHandAsync(1, 0);            // play Rebellious Hammerhead
    await g.chooseYesAsync(1);                      // choose to deal damage
    await g.chooseGroundUnitAsync(2, 0);            // deal damage to Gamorrean Guard
    await g.playCardFromHandAsync(1, 0);            // play Rebel Assault event
    await g.chooseGroundUnitAsync(1, 0);            // choose K-2SO
    await g.chooseGroundUnitAsync(2, 0);            // attack Gamorrean Guard
    await g.chooseGroundUnitAsync(1, 1);            // choose Sabine Wren (deployed leader)
    await g.chooseBaseAsync(2);                     // attack opponent base
    // assert
    expect(g.state.player1.base.damage).toBe(24);
    expect(g.state.player2.base.damage).toBe(25);
    expect(g.state.defeatedPlayers).toEqual([2]);
  });

  it("produces same result with different order of actions", async () => {
    // arrange
    const g = new GameTestAdapter();
    g.loadNewState(sabineWrenCadBaneSimplePuzzleState);
    // act
    await g.playCardFromHandAsync(1, 1);            // play Precision Fire event
    await g.chooseGroundUnitAsync(1, 1);            // choose Reckless Gunslinger (now has Saboteur)
    await g.chooseBaseAsync(2);                     // attack opponent base
    await g.useLeaderAbilityAsync(1);               // use Sabine's leader ability
    await g.playCardFromHandAsync(1, 0);            // play Rebellious Hammerhead
    await g.chooseYesAsync(1);                      // choose to deal damage
    await g.chooseGroundUnitAsync(2, 0);            // deal damage to Gamorrean Guard
    await g.deployLeaderAsync(1);                   // deploy Sabine
    await g.playCardFromHandAsync(1, 0);            // play Rebel Assault event
    await g.chooseGroundUnitAsync(1, 0);            // choose K-2SO
    await g.chooseGroundUnitAsync(2, 0);            // attack Gamorrean Guard
    await g.chooseGroundUnitAsync(1, 1);            // choose Sabine Wren (deployed leader)
    await g.chooseBaseAsync(2);                     // attack opponent base
    // assert
    expect(g.state.player1.base.damage).toBe(24);
    expect(g.state.player2.base.damage).toBe(25);
    expect(g.state.defeatedPlayers).toEqual([2]);
  });
});