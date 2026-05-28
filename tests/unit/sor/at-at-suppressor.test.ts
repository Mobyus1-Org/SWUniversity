import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CommonSetup } from "../../test-helpers";

describe("SOR_039 AT-AT Suppressor", () => {
  it("When Played: exhausts all ground units", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "gbk", "grw", {
        my: { resourceCount: 8, handCardIds: [Cards.units.sor.atAtSuppressor] },
        their: {},
      })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // All ground units including newly played AT-AT should be exhausted
    expect(g.state.player1.groundArena.every(u => !u.ready)).toBe(true);
    expect(g.state.player2.groundArena.every(u => !u.ready)).toBe(true);
  });

  it("When Played: does not exhaust space units", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "gbk", "grw", {
        my: { resourceCount: 8, handCardIds: [Cards.units.sor.atAtSuppressor] },
        their: {},
      })
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.spaceArena[0].ready).toBe(true);
  });
});
