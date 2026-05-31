import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_231 TIE Advanced — 3/2 Space (Imperial/Command), cost 4
// "When Played: Give 2 Experience tokens to another friendly IMPERIAL unit."

describe("SOR_231 TIE Advanced", () => {
  it("prompts to choose another friendly Imperial unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.infernoFour) // Imperial unit
      .WithCardInHandForPlayer(1, Cards.units.sor.tieAdvanced)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("gives 2 Experience tokens to the chosen Imperial unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.infernoFour)
      .WithCardInHandForPlayer(1, Cards.units.sor.tieAdvanced)
      .Build();
    g.loadNewState(state);
    const infernoPlayId = state.player1.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [infernoPlayId] });

    const inferno = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.infernoFour);
    expect(inferno?.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(2);
  });

  it("auto-resolves with no prompt when no other friendly Imperial units exist", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.tieAdvanced)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
