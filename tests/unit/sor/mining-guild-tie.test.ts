import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_206 Mining Guild TIE Fighter", () => {
  it("On Attack: paying 2 resources draws a card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.miningGuildTIE)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    // Add deck card for drawing
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const handBefore = g.state.player1.hand.length;
    const readyResourcesBefore = g.state.player1.resources.filter(r => r.ready).length;
    const enemyPlayId = state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // On Attack fires: "Pay 2 to draw a card?"
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(handBefore + 1);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyResourcesBefore - 2);
  });

  it("On Attack: declining costs nothing and draws nothing", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.miningGuildTIE)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const handBefore = g.state.player1.hand.length;
    const enemyPlayId = state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(handBefore);
  });
});
