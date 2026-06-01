import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_244 Snowspeeder (Concord Dawn Interceptors) — 3/6 Space (Heroism), cost 5
// "Ambush. On Attack: Exhaust an enemy Vehicle ground unit."

describe("SOR_244 Snowspeeder", () => {
  it("exhausts an enemy Vehicle ground unit on attack", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.snowspeeder)
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt) // Vehicle
      .Build();
    g.loadNewState(state);

    const vehiclePlayId = state.player2.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vehiclePlayId] });

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("does not fire when no enemy Vehicle ground units exist", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.snowspeeder)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // not Vehicle
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
