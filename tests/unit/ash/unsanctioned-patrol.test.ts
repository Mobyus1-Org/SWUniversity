import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_222 Unsanctioned Patrol (4/4 Space, cost 4)
// "Support (When you play this unit, you may attack with another unit. It gains this unit's other
//  abilities for this attack.)"
// "Saboteur (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)"

/** A Shield token on one of player 2's units. */
function shieldToken() {
  return { cardId: Cards.upgrades.token.shield, playId: "@", owner: 2 as const, controller: 2 as const };
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.ash.unsanctionedPatrol);
}

describe("ASH_222 Unsanctioned Patrol", () => {
  it("Support grants Saboteur: the supported attacker defeats the defender's Shield and still deals damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3, no Saboteur of its own
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 defender…
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [shieldToken()]) // …behind a Shield
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Saboteur defeats the Shield BEFORE damage, so the 3 damage lands rather than being absorbed.
    expect(g.state.player2.groundArena).toHaveLength(0); // 3 damage to a 3-HP unit
  });

  it("without the grant the Shield absorbs the damage instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [shieldToken()])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // plain attack, no Support
    await g.chooseGroundUnitAsync(2, 0);

    const defender = g.state.player2.groundArena[0];
    expect(defender).toBeDefined();
    expect(defender.damage).toBe(0); // the Shield ate it
    expect(defender.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield)).toHaveLength(0);
  });
});
