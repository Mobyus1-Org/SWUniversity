import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_132 Imperial Interceptor", () => {
  it("When Played: deals 3 damage to a chosen space unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Aggression+Villainy covers both aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.imperialInterceptor)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.spaceArena[0].damage).toBe(3);
  });

  it("When Played: player may skip dealing damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.imperialInterceptor)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
});
