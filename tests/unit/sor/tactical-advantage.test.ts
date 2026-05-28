import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

describe("SOR_124 Tactical Advantage", () => {
  it("gives a unit +2/+2 for this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.tacticalAdvantage)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(5); // 3 + 2
    expect(unit.TotalHP()).toBe(5);      // 3 + 2
  });
});
