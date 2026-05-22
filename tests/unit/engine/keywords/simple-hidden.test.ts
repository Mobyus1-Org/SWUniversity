import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";

describe("Simple Hidden Test", () => {
  it("a unit played this phase with Hidden should not be a valid attack target", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.units.lof.witchOfTheMist)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build()
    ;
    g.loadNewState(s);
    // act — player 1 plays Witch of the Mist this phase
    await g.playCardFromHandAsync(1, 0);
    // player 2 initiates an attack; Witch was played this phase so Hidden applies
    await g.attackWithGroundUnitAsync(2, 0);
    // assert — only Battlefield Marine is a valid target, not Witch of the Mist
    const lastDispatch = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(lastDispatch!.fromPlayIds!.length).toBe(1);
  });
});
