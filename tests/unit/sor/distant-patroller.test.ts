import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_060 Distant Patroller", () => {
  it("When Defeated: gives a Shield token to a Vigilance unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      // Distant Patroller is a SPACE unit (1 HP)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.distantPatroller)
      // AT-AT Suppressor has Vigilance aspect — valid shield target
      .WithGroundUnitForPlayer(1, Cards.units.sor.atAtSuppressor)
      // Enemy space unit — will counter-kill the 1-HP patroller
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const atAtPlayId = state.player1.groundArena[0].playId;
    const enemyPlayId = state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // When Defeated fires: option to give Shield to Vigilance unit
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [atAtPlayId] });

    expect(g.state.player1.groundArena.find(u => u.playId === atAtPlayId)?.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(true);
  });

  it("When Defeated: player may decline the Shield token", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.distantPatroller)
      .WithGroundUnitForPlayer(1, Cards.units.sor.atAtSuppressor)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const enemyPlayId = state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    await g.chooseNoAsync(1);

    // No shield token on AT-AT
    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === Cards.upgrades.token.shield)).toHaveLength(0);
  });
});
