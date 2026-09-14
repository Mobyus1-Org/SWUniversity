import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_067 Cloaked StarViper (Unit 3/2 Space, cost 4, Vigilance)
//   "When Played: Give 2 Shield tokens to this unit."

describe("JTL_067 Cloaked StarViper", () => {
  it("enters play with exactly 2 Shield tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithCardInHandForPlayer(1, Cards.units.jtl.cloakedStarViper)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const viper = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.jtl.cloakedStarViper)!;
    expect(viper.upgrades.map(u => u.cardId)).toEqual([Cards.upgrades.token.shield, Cards.upgrades.token.shield]);
  });
});
