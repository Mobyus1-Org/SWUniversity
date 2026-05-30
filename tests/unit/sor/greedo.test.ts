import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_204 Greedo — When Defeated: You may discard a card from your deck.
// If it's not a unit, deal 2 damage to a ground unit.
// Greedo is 3/1. Battlefield Marine (3/3) kills Greedo in one hit but also dies.

async function defeatGreedo(g: GameTestAdapter) {
  const greedoPlayId = g.state.player1.groundArena[0].playId;
  await g.attackWithGroundUnitAsync(2, 0); // Marine attacks
  await g.dispatchAsync(2, "choose-target", { targetPlayIds: [greedoPlayId] });
  // Both die: Marine (HP 3, takes 3 from Greedo) and Greedo (HP 1, takes 3 from Marine)
}

describe("SOR_204 Greedo", () => {
  it("offers discard option when deck is non-empty", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.greedo)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];

    await defeatGreedo(g);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("mills a unit card — no follow-up damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.greedo)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];

    await defeatGreedo(g);
    await g.chooseYesAsync(1);

    expect(g.state.player1.deck.length).toBe(0);
    expect(g.state.player1.discard.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("mills a non-unit — deals 2 damage to a chosen ground unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.greedo)
      .WithGroundUnitForPlayer(1, Cards.units.sor.syndicateLackeys) // damage target
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.events.sor.strikeTrue }]; // non-unit on top
    const damageTargetPlayId = state.player1.groundArena[1].playId;

    await defeatGreedo(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [damageTargetPlayId] });

    expect(g.state.player1.deck.length).toBe(0);
    expect(g.state.player1.groundArena[0].damage).toBe(2); // syndicateLackeys took 2
  });

  it("skips when player declines", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.greedo)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.events.sor.strikeTrue }];

    await defeatGreedo(g);
    await g.chooseNoAsync(1);

    expect(g.state.player1.deck.length).toBe(1); // not milled
  });

  it("does not offer when deck is empty", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.greedo)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [];

    await defeatGreedo(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
