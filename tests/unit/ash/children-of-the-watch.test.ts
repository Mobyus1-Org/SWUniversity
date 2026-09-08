import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_111 Children of the Watch. Cost 6, 3/3 Ground Mandalorian.
//   "When Played: Create 2 Mandalorian tokens."
//
// The token itself has Shielded, so each one arrives carrying a Shield.

const COTW = Cards.units.ash.childrenOfTheWatch;
const MANDO_TOKEN = Cards.units.token.mandalorian;
const SHIELD = Cards.upgrades.token.shield;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_111 Children of the Watch", () => {
  it("creates exactly 2 Mandalorian tokens when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, COTW).Build());

    await g.playCardFromHandAsync(1, 0);

    const tokens = g.state.player1.groundArena.filter(u => u.cardId === MANDO_TOKEN);
    expect(tokens).toHaveLength(2);
    expect(g.state.player1.groundArena.some(u => u.cardId === COTW)).toBe(true);
  });

  it("each token arrives with its own Shield, from the token's own Shielded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, COTW).Build());

    await g.playCardFromHandAsync(1, 0);

    const tokens = g.state.player1.groundArena.filter(u => u.cardId === MANDO_TOKEN);
    for (const token of tokens) {
      expect(token.upgrades.filter(u => u.cardId === SHIELD)).toHaveLength(1);
    }
  });

  it("creates them for the player who played it, not the opponent", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, COTW).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena.filter(u => u.cardId === MANDO_TOKEN)).toHaveLength(0);
  });
});
