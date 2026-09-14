import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_176 Caught in the Crossfire — "Choose 2 enemy units in the same arena. Each of those units
// deals damage equal to its power to the other."
//
// "The same arena" is where the units ARE, not their printed arena.

describe("TWI_176 Caught in the Crossfire — live arenas", () => {
  it("a space card fighting in the ground arena pairs with a ground unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.twi.caughtInTheCrossfire)
      .WithGroundUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing) // printed Space, in the ground arena
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const first = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect([...(first.fromPlayIds ?? [])].sort()).toEqual(state.player2.groundArena.map(u => u.playId).sort());

    await g.chooseGroundUnitAsync(2, 0);
    const second = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(second.fromPlayIds).toEqual([state.player2.groundArena[1].playId]);
  });
});
