import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_045 Yoda (Old Master) — 2/4 Ground (Heroism), cost 3
// "Restore 2. When Defeated: Choose any number of players. They each draw a card."

describe("SOR_045 Yoda", () => {
  it("both players draw when both are chosen", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt) // 9 power — kills Yoda (4 HP), no On Attack
      .WithGroundUnitForPlayer(2, Cards.units.sor.yoda)                // 2/4
      .Build();
    g.loadNewState(state);

    state.player1.deck.push({ cardId: Cards.units.sor.battlefieldMarine });
    state.player2.deck.push({ cardId: Cards.units.sor.battlefieldMarine });

    const yodaPlayId = state.player2.groundArena[0].playId;
    const handBefore1 = g.state.player1.hand.length;
    const handBefore2 = g.state.player2.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [yodaPlayId] });

    // Yoda's WD fires for player 2 (controller): "You draw a card?"
    await g.chooseYesAsync(1);
    // "Opponent draws a card?" for player 1
    await g.chooseYesAsync(1);

    expect(g.state.player2.hand.length).toBe(handBefore2 + 1);
    expect(g.state.player1.hand.length).toBe(handBefore1 + 1);
  });

  it("only controller draws when opponent declines", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt)
      .WithGroundUnitForPlayer(2, Cards.units.sor.yoda)
      .Build();
    g.loadNewState(state);

    state.player1.deck.push({ cardId: Cards.units.sor.battlefieldMarine });
    state.player2.deck.push({ cardId: Cards.units.sor.battlefieldMarine });

    const yodaPlayId = state.player2.groundArena[0].playId;
    const handBefore1 = g.state.player1.hand.length;
    const handBefore2 = g.state.player2.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [yodaPlayId] });

    await g.chooseYesAsync(1); // player 2 (controller) draws
    await g.chooseNoAsync(1);  // player 1 (opponent) does not draw

    expect(g.state.player2.hand.length).toBe(handBefore2 + 1);
    expect(g.state.player1.hand.length).toBe(handBefore1);
  });

  it("no one draws when both are declined", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker)
      .WithGroundUnitForPlayer(2, Cards.units.sor.yoda)
      .Build();
    g.loadNewState(state);

    const yodaPlayId = state.player2.groundArena[0].playId;
    const handBefore1 = g.state.player1.hand.length;
    const handBefore2 = g.state.player2.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [yodaPlayId] });

    await g.chooseNoAsync(1);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(handBefore1);
    expect(g.state.player2.hand.length).toBe(handBefore2);
  });
});
