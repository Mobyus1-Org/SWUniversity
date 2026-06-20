import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Exercises the Credit consumption / {1R} discount payment flow.
// battlefieldMarine costs 2, gamorreanGuards costs 4.

function readyCount(resources: { ready: boolean }[]): number {
  return resources.filter(r => r.ready).length;
}

describe("Credit payment discount", () => {
  it("does not prompt when the player controls no Credits", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    // Plays straight through with no option prompt; pays full cost of 2.
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(readyCount(g.state.player1.resources)).toBe(3); // 5 - 2
  });

  it("single-Credit case auto-spends 1 on Yes (Use 1 Credit?)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCreditsForPlayer(1, 1)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");

    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(readyCount(g.state.player1.resources)).toBe(4); // 5 - (2-1)
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("declining (No) pays full cost and keeps Credits", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCreditsForPlayer(1, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "No");

    expect(g.state.player1.supplemental.creditTokens).toBe(2);
    expect(readyCount(g.state.player1.resources)).toBe(3); // 5 - 2
  });

  it("multi-Credit case lets the player choose how many to defeat", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCreditsForPlayer(1, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 (on-aspect)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes"); // Use Credits?
    await g.chooseOptionAsync(1, "2");   // defeat 2 of up to 2 useful

    expect(g.state.player1.supplemental.creditTokens).toBe(1); // 3 - 2
    expect(readyCount(g.state.player1.resources)).toBe(5); // 5 - (2-2)
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("Credits can fully cover the cost when resources are exhausted", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 0) // no resources
      .WithCreditsForPlayer(1, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 (on-aspect)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseOptionAsync(1, "2"); // defeat 2 → pay 0

    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });
});
