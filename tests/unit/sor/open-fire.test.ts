import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CommonSetup } from "../../test-helpers";

describe("SOR_172 Open Fire", () => {
  it("deals 4 damage to a unit", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "rgw", "rbk", {
        my: { resourceCount: 3, handCardIds: [Cards.events.sor.openFire] },
        their: {},
      })
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });
});
