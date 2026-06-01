import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_197 Lando Calrissian (Responsible Businessman) — 2/4 Ground (Cunning), cost 3
// "Saboteur. When Played: Return up to 2 friendly resources to their owners' hands."

describe("SOR_197 Lando Calrissian", () => {
  it("returns up to 2 resources to hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    g.loadNewState(state);

    const resources = state.player1.resources;
    const r1PlayId = resources[0].playId;
    const r2PlayId = resources[1].playId;

    await g.playCardFromHandAsync(1, 0);
    const handBefore = g.state.player1.hand.length;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [r1PlayId, r2PlayId] });

    expect(g.state.player1.hand.length).toBe(handBefore + 2);
    expect(g.state.player1.resources.some(r => r.playId === r1PlayId)).toBe(false);
    expect(g.state.player1.resources.some(r => r.playId === r2PlayId)).toBe(false);
  });

  it("returns 0 resources when empty selection is chosen", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    g.loadNewState(state);

    const resourcesBefore = state.player1.resources.length;

    await g.playCardFromHandAsync(1, 0);
    const handBefore = g.state.player1.hand.length;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.resources.length).toBe(resourcesBefore);
    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("does nothing when no resources are available", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    g.loadNewState(state);

    // After playing cost-3 card with 3 resources, no resources remain
    state.player1.resources = [];

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
