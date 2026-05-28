import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_169 Keep Fighting", () => {
  it("readies an exhausted unit with 3 or less power", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Aggression covers SOR_169's Aggression
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.keepFighting)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false) // starts exhausted
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });
});
