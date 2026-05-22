import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";

import { sabineWrenCadBaneSimplePuzzleState } from "../_gamestates/simple";
import { NeedsTarget } from "@/lib/engine/message-types";

describe("Sabine Wren / Cad Bane Simple Puzzle", () => {
  it("produces only Player 1 as winner when simple puzzle is completed", async () => {
    // arrange
    const g = new GameTestAdapter();
    g.loadNewState(sabineWrenCadBaneSimplePuzzleState);
    // act
    await g.playCardFromHandAsync(1, 1);            // play Precision Fire event
    await g.chooseGroundUnitAsync(1, 1);            // choose Reckless Gunslinger (now has Saboteur)
    await g.chooseBaseAsync(1, 2);                     // attack opponent base
    await g.useLeaderAbilityAsync(1);               // use Sabine's leader ability
    await g.deployLeaderAsync(1);                   // deploy Sabine
    await g.playCardFromHandAsync(1, 0);            // play Rebellious Hammerhead
    await g.chooseYesAsync(1);                      // choose to deal damage
    await g.chooseGroundUnitAsync(2, 0);            // deal damage to Gamorrean Guard
    await g.playCardFromHandAsync(1, 0);            // play Rebel Assault event
    await g.chooseGroundUnitAsync(1, 0);            // choose K-2SO
    await g.chooseGroundUnitAsync(2, 0);            // attack Gamorrean Guard
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");            // choose "deal_base_damage" option for K-2SO's when defeated ability
    await g.chooseGroundUnitAsync(1, 1);            // choose Sabine Wren (deployed leader)
    await g.chooseBaseAsync(1, 2);                     // attack opponent base
    //Now Rebel Assault is fully resolved, so we can check the final state of the game
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
    await g.chooseBaseAsync(1, 2);                     // attack opponent base
    await g.useLeaderAbilityAsync(1);               // use Sabine's leader ability
    await g.playCardFromHandAsync(1, 0);            // play Rebellious Hammerhead
    await g.chooseYesAsync(1);                      // choose to deal damage
    await g.chooseGroundUnitAsync(2, 0);            // deal damage to Gamorrean Guard
    await g.deployLeaderAsync(1);                   // deploy Sabine
    await g.playCardFromHandAsync(1, 0);            // play Rebel Assault event
    await g.chooseGroundUnitAsync(1, 0);            // choose K-2SO
    await g.chooseGroundUnitAsync(2, 0);            // attack Gamorrean Guard
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");            // choose "deal_base_damage" option for K-2SO's when defeated ability
    await g.chooseGroundUnitAsync(1, 1);            // choose Sabine Wren (deployed leader)
    await g.chooseBaseAsync(1, 2);                     // attack opponent base
    //Now Rebel Assault is fully resolved, so we can check the final state of the game
    // assert
    expect(g.state.player1.base.damage).toBe(24);
    expect(g.state.player2.base.damage).toBe(25);
    expect(g.state.defeatedPlayers).toEqual([2]);
  });

  it("should deal 2 damage to Sentinel and 1 damage to base", async () => {
    // arrange
    const g = new GameTestAdapter();
    g.loadNewState(sabineWrenCadBaneSimplePuzzleState);
    // act
    await g.deployLeaderAsync(1);
    await g.attackWithGroundUnitAsync(1, 2);
    const lastDispatch = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(lastDispatch.fromPlayIds!.length).toBe(1);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(12);
    expect(g.state.player1.groundArena[2].damage).toBe(4);
  });

});