import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_056 Hondo Ohnaka — 4/4 Ground, Shielded.
// "On Attack: You may take control of a non-Pilot upgrade on a unit and attach it to a different eligible unit."

describe("JTL_056 Hondo Ohnaka — On Attack", () => {
  it("moves a non-Pilot upgrade from one unit to a different unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.jtl.hondoOhnaka)          // [0] attacker
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)     // [1] source of the upgrade
      .WithUpgradesOnGroundUnitForPlayer(1, 1, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)     // destination
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0); // Hondo attacks
    await g.chooseBaseAsync(1, 2);           // ...the enemy base
    await g.chooseYesAsync(1);               // trigger On Attack
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 1, 0); // pick the Experience token on the marine
    await g.chooseGroundUnitAsync(2, 0);     // attach it to the enemy marine

    expect(g.state.player1.groundArena[1].upgrades).toHaveLength(0);
    expect(g.state.player2.groundArena[0].upgrades.map(u => u.cardId))
      .toContain(Cards.upgrades.token.experience);
  });

  it("moving Traitorous to a different unit steals that unit and reverts the old one", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.jtl.hondoOhnaka)          // [0] attacker
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)     // [1] enemy unit currently stolen via Traitorous
      .WithUpgradesOnGroundUnitForPlayer(1, 1, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.traitorous, 1),
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)      // eligible unit to steal instead
      .WithActivePlayer(1)
      .Build();
    // The stolen marine is owned by player 2 but controlled by player 1.
    state.player1.groundArena[1].owner = 2;
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0); // Hondo attacks
    await g.chooseBaseAsync(1, 2);           // ...the enemy base
    await g.chooseYesAsync(1);               // trigger On Attack
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 1, 0); // pick Traitorous on the marine
    await g.chooseGroundUnitAsync(2, 0);     // move it onto the echo base defender

    const allUnits = [...g.state.player1.groundArena, ...g.state.player2.groundArena];
    const defender = allUnits.find(u => u.cardId === Cards.units.sor.echoBaseDefender)!;
    const marine = allUnits.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;

    // Traitorous now on the echo base defender, which player 1 controls.
    expect(defender.upgrades.map(u => u.cardId)).toContain(Cards.upgrades.sor.traitorous);
    expect(defender.controller).toBe(1);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.echoBaseDefender)).toBe(true);

    // The marine lost Traitorous and reverted to its owner, player 2.
    expect(marine.upgrades).toHaveLength(0);
    expect(marine.controller).toBe(2);
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });
});
