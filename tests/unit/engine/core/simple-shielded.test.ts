import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Simple Shielded Test", () => {
  it("should enter play with a shield token when played from hand", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.craftySmuggler)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    // assert
    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.sor.craftySmuggler);
    expect(g.state.player1.groundArena[0].upgrades.length).toBe(1);
    expect(g.state.player1.groundArena[0].upgrades[0].cardId).toBe(Cards.upgrades.token.shield);
  });
});