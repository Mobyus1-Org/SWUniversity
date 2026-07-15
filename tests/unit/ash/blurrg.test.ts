import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_121 Blurrg (3/4 Ground, cost 3)
// "Support (When you play this unit, you may attack with another unit. It gains this unit's other
//  abilities for this attack.)"
// "Overwhelm (When attacking an enemy unit, deal excess damage to the opponent's base.)"

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.ash.blurrg);
}

describe("ASH_121 Blurrg", () => {
  it("Support grants Overwhelm to the supported attacker for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // 3/3, no Overwhelm of its own
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2) // 3/3 with 2 damage → 1 HP left
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // our Marine attacks…
    await g.chooseGroundUnitAsync(2, 0); // …the 1-HP enemy Marine

    expect(g.state.player2.groundArena).toHaveLength(0); // defender defeated
    expect(g.state.player2.base.damage).toBe(2);         // 3 power – 1 HP = 2 excess, via granted Overwhelm
  });

  it("the grant is what does it — the same attack without Support spills nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // the Marine attacks on its own, no Blurrg played
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0); // no Overwhelm — the excess is lost
  });

  it("the granted Overwhelm lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // The ForAttack grant must be cleared once the attack resolves.
    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(g.state.currentEffects.filter(e => e.targetPlayId === marine.playId)).toHaveLength(0);
  });

  it("Blurrg has Overwhelm on its own attacks too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.blurrg)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2) // 1 HP left
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(2); // Blurrg's 3 power – 1 HP
  });
});
