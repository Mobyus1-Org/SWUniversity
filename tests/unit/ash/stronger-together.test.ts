import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_140 Stronger Together (Event, cost 4) — "Create 2 Mandalorian tokens."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.ash.strongerTogether);
}

describe("ASH_140 Stronger Together", () => {
  it("creates 2 Mandalorian tokens for the player", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === Cards.events.ash.strongerTogether);
    await g.playCardFromHandAsync(1, handIdx);

    const mandalorianTokens = g.state.player1.groundArena.filter(u => u.cardId === "ASH_T01");
    expect(mandalorianTokens.length).toBe(2);
  });
});
