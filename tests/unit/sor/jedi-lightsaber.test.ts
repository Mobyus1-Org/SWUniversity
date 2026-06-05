import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_054 — Jedi Lightsaber (Upgrade, Vigilance+Heroism, cost 3, +3/+0 power)
// "Attach to a non-VEHICLE unit.
//  If attached unit is a FORCE unit, it gains:
//  'On Attack: Give the defender –2/–2 for this phase.'"

describe("SOR_054 — Jedi Lightsaber", () => {
  it("gives defender -2/-2 for the phase when attached to a Force unit", async () => {
    // Kanan Jarrus (SOR_047, Force, 4/5) + Jedi Lightsaber (+3/+0) = 7 power vs Walker (6/9).
    // Defender -2/-2: effective HP=7, effective counter-power=4.
    // Walker takes 7 damage (defeated). Kanan takes 4 counter-damage (6-2).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca) // Vigilance+Heroism
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus) // Force, 4/4
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 5/9
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.jediLightsaber, 1),
      ])
      .Build();
    g.loadNewState(state);

    const kananPlayId = state.player1.groundArena[0].playId;
    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    // Walker (effective 3 counter-power, 7 effective HP) receives 7 damage → defeated.
    expect(g.state.player2.groundArena.find(u => u.playId === walkerPlayId)).toBeUndefined();
    // Kanan takes 4 counter-damage (walker's 6-2=4 effective power).
    const kanan = g.state.player1.groundArena.find(u => u.playId === kananPlayId);
    expect(kanan?.damage).toBe(4);
  });

  it("does NOT give defender -2/-2 when attached to a non-Force unit", async () => {
    // Battlefield Marine (3/3, NOT Force) + Jedi Lightsaber (+3) = 6 power vs Walker (6/9).
    // No -2/-2: walker retains full 6 counter-power and 9 HP.
    // Marine takes 6 damage → defeated. Walker takes 6 damage (survives with 3 HP).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // NOT Force
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 5/9
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.jediLightsaber, 1),
      ])
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;
    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    // Marine defeated. Walker takes 6 damage, survives (9-6=3 HP left).
    expect(g.state.player1.groundArena.find(u => u.playId === marinePlayId)).toBeUndefined();
    const walker = g.state.player2.groundArena.find(u => u.playId === walkerPlayId);
    expect(walker?.damage).toBe(6);
  });

  it("proceeds normally when Force unit attacks a base", async () => {
    // Kanan (4+3=7 power) with Jedi Lightsaber attacks base — no error, 7 damage to base.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.jediLightsaber, 1),
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(7);
  });

  it("-2/-2 is stored as a Phase-duration current effect on the defender", async () => {
    // Kanan (7 power) vs Devastator (8/8). Devastator survives with 1 HP.
    // The SOR_054 Phase effect should be on the devastator after the attack.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithGroundUnitForPlayer(2, Cards.units.sor.devastator) // 8/8 — survives 7 damage
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.jediLightsaber, 1),
      ])
      .Build();
    g.loadNewState(state);

    const devastatorPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [devastatorPlayId] });

    expect(g.state.currentEffects.some(
      e => e.cardId === "SOR_054" && e.targetPlayId === devastatorPlayId,
    )).toBe(true);
  });
});
