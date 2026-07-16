import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_235 Ruthless Assassin (3/3 Ground, cost 2) —
//   "Overwhelm (When attacking an enemy unit, deal excess damage to the opponent's base.)
//    When Played: Deal 2 damage to a friendly unit."
describe("SHD_235 Ruthless Assassin", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku) // Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("When Played: deals 2 damage to a chosen friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // friendly recipient
        .WithCardInHandForPlayer(1, Cards.units.shd.ruthlessAssassin)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // the friendly Marine

    expect(g.state.player1.groundArena[0].damage).toBe(2);
  });

  it("Overwhelm: deals excess combat damage to the opponent's base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.shd.ruthlessAssassin) // 3 power
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid)    // 1 HP defender
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Defender defeated by 1; 2 excess damage overwhelms to the base.
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.token.battleDroid)).toBe(false);
    expect(g.state.player2.base.damage).toBe(2);
  });
});
