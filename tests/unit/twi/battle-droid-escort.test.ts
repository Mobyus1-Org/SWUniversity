import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_229 Battle Droid Escort — "When Played/When Defeated: Create a Battle Droid token."
// Bug: playing it created 2 Battle Droid tokens instead of 1 — its When Played effect lived
// in resolveWhenPlayed (called once as a preview in queueUnitEntryTriggers AND again on
// trigger-bag drain) instead of resolveWhenPlayedTrigger (called once).
describe("TWI_229 Battle Droid Escort", () => {
  it("creates exactly one Battle Droid token When Played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.countDooku)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.units.twi.battleDroidEscort)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const droids = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.battleDroid);
    expect(droids).toHaveLength(1);
    // The Escort itself is also in play.
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.battleDroidEscort)).toBe(true);
  });
});
