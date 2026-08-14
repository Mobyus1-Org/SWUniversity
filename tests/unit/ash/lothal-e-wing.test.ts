import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { Cards } from "../../card-helpers";

// ASH_057 Lothal E-Wing (2/3 Space) —
// "While an enemy unit is upgraded, this unit gains Restore 2."
function setup(options: { enemyUpgraded?: boolean; friendlyUpgraded?: boolean } = {}) {
  let builder = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 10)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, Cards.units.ash.lothalEWing)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine);

  if (options.enemyUpgraded) {
    builder = builder.WithUpgradesOnGroundUnitForPlayer(2, 0, [{ cardId: Cards.upgrades.sor.academyTraining, playId: "@", owner: 2, controller: 2 }]);
  }
  if (options.friendlyUpgraded) {
    builder = builder
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [{ cardId: Cards.upgrades.sor.academyTraining, playId: "@", owner: 2, controller: 2 }]);
  }

  const g = new GameTestAdapter();
  g.loadNewState(builder.Build());
  const eWing = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.lothalEWing)!;
  return { g, eWing };
}

describe("ASH_057 Lothal E-Wing", () => {
  it("gains Restore 2 while an enemy unit is upgraded", () => {
    const { eWing } = setup({ enemyUpgraded: true });
    expect(HasKeyword(Cards.units.ash.lothalEWing, "Restore", eWing.playId, 1)).toBe(true);
    expect(RestoreAmount(Cards.units.ash.lothalEWing, eWing.playId, 1)).toBe(2);
  });

  it("has no Restore while no enemy unit is upgraded", () => {
    const { eWing } = setup();
    expect(RestoreAmount(Cards.units.ash.lothalEWing, eWing.playId, 1)).toBe(0);
  });

  // "an enemy unit" — a friendly upgraded unit must not switch it on.
  it("does not count a friendly upgraded unit", () => {
    const { eWing } = setup({ friendlyUpgraded: true });
    expect(RestoreAmount(Cards.units.ash.lothalEWing, eWing.playId, 1)).toBe(0);
  });
});
