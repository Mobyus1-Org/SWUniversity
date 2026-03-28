import { describe, expect, it } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("Overwhelm", () => {
  it("deals excess damage to the opponent's base", async () => {
    // arrange
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    const g = new GameTestAdapter();
    g.loadNewState(s);
    // act
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(1);
  });
});