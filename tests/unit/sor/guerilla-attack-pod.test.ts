import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_148 Guerilla Attack Pod (Chewbacca) — 5/5 Ground (Heroism), cost 5
// "Grit. When Played: If a base has 15 or more damage on it, ready this unit."

describe("SOR_148 Guerilla Attack Pod", () => {
  it("readies itself when a base has 15 or more damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.units.sor.guerillaAttackPod)
      .Build();
    g.loadNewState(state);

    state.player2.base.damage = 15;

    await g.playCardFromHandAsync(1, 0);

    const self = g.state.player1.groundArena[0];
    expect(self.ready).toBe(true);
  });

  it("does not ready itself when no base has 15+ damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.units.sor.guerillaAttackPod)
      .Build();
    g.loadNewState(state);

    state.player1.base.damage = 14;
    state.player2.base.damage = 14;

    await g.playCardFromHandAsync(1, 0);

    const self = g.state.player1.groundArena[0];
    expect(self.ready).toBe(false);
  });
});
