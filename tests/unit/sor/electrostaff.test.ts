import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_071 — Electrostaff (Upgrade, Vigilance, cost 2, +2/+2)
// "Attach to a non-VEHICLE unit.
//  While attached unit is defending, the attacker gets –1/–0."
//
// The –1/–0 reduces the attacker's POWER by 1 during the combat resolution.

describe("SOR_071 — Electrostaff", () => {
  it("reduces attacker power by 1 when defender has Electrostaff", async () => {
    // Attacker: Battlefield Marine (3/3) attacks Defender: Battlefield Marine (3/3) + Electrostaff (+2/+2).
    // Defender effectively has 5 HP and 5 counter-power normally.
    // Attacker has 3 power. With Electrostaff: effective attacker power = 3-1 = 2.
    // So defender takes 2 damage (not 3).
    // Defender's counter-power: 5 (unaffected).
    // Attacker takes 5 counter-damage → defeated (3 HP < 5).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // attacker: 3/3
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // defender
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.electrostaff, 2),
      ])
      .Build();
    g.loadNewState(state);

    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    // Defender (3/3 + Electrostaff +2/+2 = 5/5) took 2 damage from attacker (3-1=2 power).
    const defender = g.state.player2.groundArena.find(u => u.playId === defenderPlayId);
    expect(defender).toBeDefined();
    expect(defender?.damage).toBe(2);
  });

  it("applies -1 to attacker's effective power (Distant Patroller 2 power → 1 damage)", async () => {
    // Distant Patroller (SOR_060): 2 power, 1 HP.
    // Defender: Marine (3/3) + Electrostaff (+2/+2) = 5/5.
    // Without Electrostaff: attacker deals 2 damage.
    // With Electrostaff: attacker effective power = 2-1 = 1. Defender takes 1 damage.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.distantPatroller) // 2/1
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 + Electrostaff → 5/5
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.electrostaff, 2),
      ])
      .Build();
    g.loadNewState(state);

    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    // Patroller (2 power -1 from Electrostaff) deals 1 damage to defender.
    const defender = g.state.player2.groundArena.find(u => u.playId === defenderPlayId);
    expect(defender?.damage).toBe(1);
  });

  it("does NOT reduce attacker power when unit is NOT defending (attacker has Electrostaff)", async () => {
    // Electrostaff on the ATTACKING unit. "While defending" means only when that unit defends.
    // When the unit WITH Electrostaff is the attacker, no -1/-0 applies to themselves.
    // Attacker: Marine + Electrostaff (3+2=5 power). Defender: Marine (3/3).
    // Marine with Electrostaff deals 5 damage to defender → defender defeated.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // attacker with Electrostaff
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // defender (no Electrostaff)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.electrostaff, 1),
      ])
      .Build();
    g.loadNewState(state);

    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    // No -1 on attacker's power (Electrostaff only affects when defending).
    // Attacker has 3+2=5 power → defender (3 HP) takes 5 → defeated.
    expect(g.state.player2.groundArena.find(u => u.playId === defenderPlayId)).toBeUndefined();
  });
});
