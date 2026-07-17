import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_204 Blade Three (3 cost, 4/2, Space) — "When your base is dealt damage: Give an Advantage
// token to this unit." Damage from ANY source counts (combat, events, abilities), but only its
// own controller's base — this exercises the generic when-base-damaged trigger plumbing.

function advantageCount(unit: { upgrades: { cardId: string }[] } | undefined): number {
  return unit ? unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage).length : -1;
}

describe("ASH_204 Blade Three", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
  }

  it("grants itself an Advantage token when its controller's base takes combat damage (one token, not one per point)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.bladeThree)
        .WithGroundUnitForPlayer(2, Cards.units.ash.grandAdmiralThrawn) // 5 power attacker
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1); // attack player 1's base for 5 damage

    const blade = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.bladeThree);
    expect(g.state.player1.base.damage).toBe(5);
    expect(advantageCount(blade)).toBe(1); // one instance of damage → one token, not five
  });

  it("grants a token when its controller's base is damaged by an event, not just combat", async () => {
    // SOR_235 Galactic Ambition deals damage to only the caster's own base (no unit damage), so
    // Blade Three survives to receive its token — Operation Cinder would kill 2-HP Blade Three
    // with its own board-wide sweep before the reaction could be observed.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyLeader(Cards.leaders.sor.darthVader)
        .WithActivePlayer(1)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.bladeThree)
        .WithCardInHandForPlayer(1, Cards.events.sor.galacticAmbition)
        .WithCardInHandForPlayer(1, Cards.units.sor.deathTrooper) // cost 3
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // play Galactic Ambition
    await g.chooseCardFromHandAsync(1, 0); // pick death trooper (free) — 3 damage to own base

    expect(g.state.player1.base.damage).toBe(3);
    const blade = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.bladeThree);
    expect(advantageCount(blade)).toBe(1);
  });

  it("does not grant a token when the enemy's base takes damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.bladeThree)
        .WithGroundUnitForPlayer(1, Cards.units.ash.grandAdmiralThrawn) // attacker
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attack player 2's (enemy) base

    const blade = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.bladeThree);
    expect(g.state.player2.base.damage).toBe(5);
    expect(advantageCount(blade)).toBe(0);
  });
});
