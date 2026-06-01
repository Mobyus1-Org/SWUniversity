import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_209 Pirated Starfighter (Kylo Ren) — 3/3 Space (Cunning), cost 2
// "Raid 1. When Played: Return a friendly non-leader unit to its owner's hand."

describe("SOR_209 Pirated Starfighter", () => {
  it("returns a chosen friendly non-leader unit to hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)    // Cunning base
      .MyLeader(Cards.leaders.sor.hanSolo)      // Cunning+Heroism — covers Cunning
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.piratedStarfighter)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const handBefore = g.state.player1.hand.length;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player1.hand.length).toBe(handBefore + 1);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("bounces a token (defeats it, does not add to hand)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.piratedStarfighter)
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
      .Build();
    g.loadNewState(state);

    const tokenPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const handBefore = g.state.player1.hand.length;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [tokenPlayId] });

    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player1.hand.length).toBe(handBefore); // token not returned to hand
  });
});
