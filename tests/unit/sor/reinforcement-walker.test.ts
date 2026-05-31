import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_119 Reinforcement Walker — 6/9 Ground (Command), cost 8
// When Played/On Attack: Look at the top card of your deck.
// Either draw that card or discard it and heal 3 damage from your base.

describe("SOR_119 Reinforcement Walker", () => {
  it("When Played: offers Yes/No choice when deck is non-empty", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("When Played: choosing Yes draws the top card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.deck.length).toBe(0);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("When Played: choosing No discards the top card and heals 3 from base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    state.player1.base.damage = 10;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.deck.length).toBe(0);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player1.base.damage).toBe(7); // 10 - 3
  });

  it("When Played: no effect when deck is empty", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [];

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("On Attack: offers Yes/No choice when deck is non-empty", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("On Attack: choosing Yes draws the top card before combat resolves", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.events.sor.strikeTrue }];
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });
    await g.chooseYesAsync(1);

    expect(g.state.player1.deck.length).toBe(0);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.events.sor.strikeTrue)).toBe(true);
  });
});
