import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_134 Hunting Assassin Droid (3/4 Ground) —
//   "While an enemy unit is damaged, this unit gains Raid 2. (It gets +2/+0 while attacking.)"
describe("SEC_134 Hunting Assassin Droid", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gets +2/+0 while attacking when an enemy unit is damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sec.huntingAssassinDroid)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards, true, 2) // damaged enemy
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Power 3 + Raid 2 = 5 to the enemy base.
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("control: no Raid bonus when no enemy unit is damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sec.huntingAssassinDroid)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // undamaged
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("does not count a damaged friendly unit toward the condition", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sec.huntingAssassinDroid)
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards, true, 2) // damaged FRIENDLY
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // enemy, undamaged
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // no bonus
  });
});
