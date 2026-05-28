import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_163 Star Wing Scout", () => {
  it("When Defeated with initiative: draws 2 cards", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.starWingScout) // 1 HP — dies on counter
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // 3 power — kills scout
      .Build();
    g.loadNewState(state);

    // Add deck cards for drawing
    state.player1.deck = [
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: Cards.units.sor.battlefieldMarine },
    ];

    // Player 1 has initiative by default
    expect(state.initiativePlayer).toBe(1);

    const enemyPlayId = state.player2.spaceArena[0].playId;
    const handBefore = g.state.player1.hand.length;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.state.player1.hand.length).toBe(handBefore + 2);
  });

  it("When Defeated without initiative: does not draw", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.starWingScout)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    state.player1.deck = [
      { cardId: Cards.units.sor.battlefieldMarine },
      { cardId: Cards.units.sor.battlefieldMarine },
    ];
    state.initiativePlayer = 2; // opponent has initiative
    const enemyPlayId = state.player2.spaceArena[0].playId;
    const handBefore = g.state.player1.hand.length;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.state.player1.hand.length).toBe(handBefore);
  });
});
