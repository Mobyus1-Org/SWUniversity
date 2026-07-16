import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_194 Snub Fighter Squadron (3/4 Space, cost 4) —
//   "Ambush (When you play this unit, it may attack an enemy unit.)
//    When Played: Deal 1 damage to a space unit."
describe("ASH_194 Snub Fighter Squadron", () => {
  function build(withEnemy = true) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.ash.snubFighterSquadron);
    if (withEnemy) b.WithSpaceUnitForPlayer(2, Cards.units.token.xWing); // 2/2
    return b.Build();
  }

  it("When Played: deals 1 damage to a chosen space unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Snub Fighter Squadron — When Played");
    await g.chooseSpaceUnitAsync(2, 0); // target the enemy X-Wing
    await g.chooseNoAsync(1); // decline Ambush

    const xwing = g.state.player2.spaceArena.find(u => u.cardId === Cards.units.token.xWing);
    expect(xwing?.damage).toBe(1);
  });

  it("Ambush: may attack an enemy unit when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Snub Fighter Squadron — Ambush");
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0); // attack the X-Wing (2/2)

    // 3-power squadron vs 2/2 X-Wing: X-Wing defeated; squadron (3/4) took 2, survives.
    expect(g.state.player2.spaceArena.some(u => u.cardId === Cards.units.token.xWing)).toBe(false);
    const sq = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.snubFighterSquadron);
    expect(sq?.damage).toBe(2);
  });
});
