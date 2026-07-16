import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// ASH_030 Marrok (2/6 Ground) —
//   "Sentinel
//    While this unit is upgraded, he loses Sentinel and gains Saboteur."
describe("ASH_030 Marrok", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren);
  }

  it("has Sentinel while not upgraded", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.ash.marrok).Build());

    const marrok = g.state.player1.groundArena[0];
    expect(HasSentinel(marrok.cardId, marrok.playId, 1)).toBe(true);
    expect(HasSaboteur(marrok.cardId, marrok.playId, 1)).toBe(false);
  });

  it("loses Sentinel and gains Saboteur while upgraded", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.marrok)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
        ])
        .Build(),
    );

    const marrok = g.state.player1.groundArena[0];
    expect(HasSentinel(marrok.cardId, marrok.playId, 1)).toBe(false);
    expect(HasSaboteur(marrok.cardId, marrok.playId, 1)).toBe(true);
  });
});
