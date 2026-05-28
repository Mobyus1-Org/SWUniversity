import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

describe("SOR_076 Make an Opening", () => {
  it("gives a unit -2/-2 for this phase and heals 2 from own base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance+Heroism covers SOR_076's Vigilance
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.makeAnOpening)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
      .Build();
    g.loadNewState(state);

    state.player1.base.damage = 5;
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // Marine is 3/3; after -2/-2 effective stats are 1/1
    const unit = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(unit.CurrentPower()).toBe(1); // 3 - 2
    expect(unit.TotalHP()).toBe(1);      // 3 - 2
    expect(g.state.player1.base.damage).toBe(3); // healed 2
  });
});
