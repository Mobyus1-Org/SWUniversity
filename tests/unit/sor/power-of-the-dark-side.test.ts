import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_041 Power of the Dark Side", () => {
  it("opponent chooses one of their non-leader units to defeat", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.powerOfTheDarkSide)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("opponent can choose their deployed leader to defeat", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.powerOfTheDarkSide)
      .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // deployed leader
      .Build();
    g.loadNewState(state);

    const leaderPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [leaderPlayId] });

    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("does nothing when the opponent has no units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.powerOfTheDarkSide)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // No resolution needed — auto-resolved with no targets
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
