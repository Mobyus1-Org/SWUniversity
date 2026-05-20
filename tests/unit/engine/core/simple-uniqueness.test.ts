import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";

describe("Simple Uniqueness", () => {
  it("prompts to defeat a copy of a unique unit", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.craftySmuggler, 10)
      .WithCardInHandForPlayer(1, Cards.units.shd.zuckuss)
      .WithCardInHandForPlayer(1, Cards.units.shd.zuckuss)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.playCardFromHandAsync(1, 0);
    const lastDispatch = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(lastDispatch.fromPlayIds!.length).toBe(2);
    await g.chooseGroundUnitAsync(1, 1);
    // assert
    expect(g.state.player1.groundArena.length).toBe(1);
  });
});