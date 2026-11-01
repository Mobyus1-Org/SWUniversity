import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_127 Resupply (Event, cost 3, Command) — reprint of SOR_126.
//   "Put this event into play as a resource."

describe("TWI_127 Resupply", () => {
  it("enters play as an exhausted resource instead of staying in the discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.twi.resupply)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    const res = g.state.player1.resources.find(r => r.cardId === Cards.events.twi.resupply);
    expect(res).toBeDefined();
    expect(res?.ready).toBe(false);
    expect(g.state.player1.resources).toHaveLength(4);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.events.twi.resupply)).toBe(false);
  });
});
