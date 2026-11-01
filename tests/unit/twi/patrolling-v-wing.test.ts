import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_107 Patrolling V-Wing (1/1 Space, cost 2, Command) — reprint of SOR_111.
//   "When Played: Draw a card."

describe("TWI_107 Patrolling V-Wing", () => {
  it("When Played: draws a card, with no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.units.twi.patrollingVWing)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([Cards.units.twi.patrollingVWing]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([Cards.units.sor.consularSecurityForce]);
    expect(g.state.player1.deck).toHaveLength(0);
  });
});
