import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_059 2-1B Surgical Droid", () => {
  it("On Attack: player may heal 2 damage from another unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.surgicalDroid)  // 2 power, 3 HP
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 3) // damaged marine
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine) // high HP — droid survives
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[1].playId;
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // On Attack fires: "Heal 2 from another unit?"
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player1.groundArena.find(u => u.playId === marinePlayId)?.damage).toBe(1);
  });

  it("On Attack: player may decline to heal", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.surgicalDroid)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 3)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[1].playId;
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena.find(u => u.playId === marinePlayId)?.damage).toBe(3);
  });
});
