import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_191 Vanguard Ace — 1/1 Space (Cunning/Heroism), cost 2
// "When Played: For each other card you played this phase, give an Experience token to this unit."

describe("SOR_191 Vanguard Ace", () => {
  it("gives 0 XP when no other cards were played this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.vanguardAce)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    const ace = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.vanguardAce);
    expect(ace?.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(0);
  });

  it("gives 2 XP when 2 other cards were played this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.vanguardAce)
      .Build();
    g.loadNewState(state);
    state.roundState.cardsPlayedThisPhase.push(
      { fromPlayer: 1, cardId: Cards.units.sor.battlefieldMarine, playId: "fake-1" },
      { fromPlayer: 1, cardId: Cards.units.sor.battlefieldMarine, playId: "fake-2" },
    );

    await g.playCardFromHandAsync(1, 0);

    const ace = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.vanguardAce);
    expect(ace?.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(2);
  });

  it("does not count cards played by the opponent", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.vanguardAce)
      .Build();
    g.loadNewState(state);
    state.roundState.cardsPlayedThisPhase.push(
      { fromPlayer: 2, cardId: Cards.units.sor.battlefieldMarine, playId: "fake-1" },
    );

    await g.playCardFromHandAsync(1, 0);

    const ace = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.vanguardAce);
    expect(ace?.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(0);
  });
});
