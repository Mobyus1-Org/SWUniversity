import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("JTL_153 Rebellious Hammerhead", () => {
  it("defeats a unit when dealt damage equals its remaining HP", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      // 5 cards in hand; after playing Hammerhead, 4 remain → deals 4 damage
      .WithCardInHandForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      // Gamorrean Guards 4/4 — exactly 4 HP so they must be defeated
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // play Rebellious Hammerhead
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(2, 0); // target Gamorrean Guards

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("deals damage without defeating when target survives", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      // 3 cards in hand; after playing Hammerhead, 2 remain → deals 2 damage to a 4 HP unit
      .WithCardInHandForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
