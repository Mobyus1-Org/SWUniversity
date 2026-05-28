import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_092 Overwhelming Barrage", () => {
  it("gives +2/+2 to chosen unit and spreads its power among all other units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.cellBlockGuard)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.cellBlockGuard, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.overwhelmingBarrage)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.spreadDamageAsync(1, [
      [2, "Ground", 0, 3],
      [2, "Ground", 1, 2],
    ])

    expect(g.state.player2.groundArena.length).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
