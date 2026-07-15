import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_241 Marrok's Fiend Fighter (3/2 Space, cost 3)
// "Support (When you play this unit, you may attack with another unit. It gains this unit's other
//  abilities for this attack.)"
// "Overwhelm (When attacking an enemy unit, deal excess damage to the opponent's base.)"
// "This unit gets +2/+0 while attacking a damaged unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.ash.marroksFiendFighter);
}

describe("ASH_241 Marrok's Fiend Fighter", () => {
  it("gets +2/+0 while attacking a damaged unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.marroksFiendFighter)
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing, true, 1) // 2/2 X-Wing with 1 damage
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // 3 power + 2 (damaged defender) = 5 into a 1-HP unit → 4 excess spills via Overwhelm.
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("gets no bonus against an undamaged unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.marroksFiendFighter)
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing) // undamaged 2/2
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(1); // 3 power – 2 HP = 1 excess only
  });

  it("Support grants both Overwhelm and the damaged-target bonus to the supported attacker", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)          // plain 3/3
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 1) // 3/3 with 1 damage → 2 HP
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Marine 3 power + 2 (granted damaged-target bonus) = 5 into 2 HP → 3 excess via granted Overwhelm.
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(3);
  });
});
