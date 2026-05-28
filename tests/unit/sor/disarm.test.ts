import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

describe("SOR_216 Disarm", () => {
  it("gives an enemy unit -4/+0 for this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo) // Cunning+Heroism covers SOR_216's Cunning
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.disarm)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const unit = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(unit.CurrentPower()).toBeLessThanOrEqual(0); // 3 - 4 = -1
    expect(unit.TotalHP()).toBe(3); // HP unchanged
  });
});
