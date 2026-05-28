import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_170 Power Failure", () => {
  it("defeats all upgrades on the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.powerFailure)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    // Add two upgrades to enemy unit
    const enemyUnit = state.player2.groundArena[0];
    enemyUnit.upgrades.push(
      { cardId: Cards.upgrades.token.experience, playId: "test-upg-1", owner: 2, controller: 2 },
      { cardId: Cards.upgrades.token.experience, playId: "test-upg-2", owner: 2, controller: 2 },
    );
    const targetPlayId = enemyUnit.playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });
});
