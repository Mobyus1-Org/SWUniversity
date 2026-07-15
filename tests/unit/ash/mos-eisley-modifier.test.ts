import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_074 Mos Eisley Modifier (1/4 Ground, cost 3)
// "Support (When you play this unit, you may attack with another unit. It gains this unit's other
//  abilities for this attack.)"
// "Grit (This unit gets +1/+0 for each damage on it.)"

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.ash.mosEisleyModifier);
}

describe("ASH_074 Mos Eisley Modifier", () => {
  it("Support grants Grit: a damaged supported attacker hits harder", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      // A 3/3 Marine carrying 2 damage: 3 power, +2 from the granted Grit.
      baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // 3 + 2 damage-on-it
  });

  it("the same damaged attacker hits for 3 without the grant", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("has Grit on its own attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.mosEisleyModifier, true, 3).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4); // 1 power + 3 damage on it
  });
});
