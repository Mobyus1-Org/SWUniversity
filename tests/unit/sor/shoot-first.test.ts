import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_217 — Shoot First (Event, 1-cost, Cunning, Trick)
// "Attack with a unit. It gets +1/+0 for this attack and deals its combat damage
// before the defender. (If the defender is defeated, it deals no combat damage.)"

describe("SOR_217 — Shoot First", () => {
  it("initiates an attack with a ready friendly unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.shootFirst)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // Play Shoot First

    // Should ask player to select an attacking unit
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("defeats the defender without taking counter-damage when first-strike kills them", async () => {
    // Battlefield Marine is 3/3. With +1/+0 from Shoot First, attacker has 4 power.
    // Defender (3/3 marine) dies from 4 damage. No counter-damage (first-strike).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.shootFirst)
      .Build();
    g.loadNewState(state);

    const friendlyMarinePlayId = state.player1.groundArena[0].playId;
    const enemyMarinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0); // Play Shoot First
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyMarinePlayId] }); // Choose attacker
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] }); // Choose target

    // Enemy marine defeated (4 damage > 3 HP)
    expect(g.state.player2.groundArena).toHaveLength(0);
    // Friendly marine took no counter-damage (first strike)
    const friendlyMarine = g.state.player1.groundArena.find(u => u.playId === friendlyMarinePlayId);
    expect(friendlyMarine?.damage).toBe(0);
  });

  it("still takes counter-damage when the defender survives", async () => {
    // Battlefield Marine (3/3) attacks a 9/9 Reinforcement Walker with +1/+0 = 4 power.
    // Walker survives (9 HP - 4 = 5 left). Walker deals 9 counter-damage to marine (kills it).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 5/9
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.shootFirst)
      .Build();
    g.loadNewState(state);

    const friendlyMarinePlayId = state.player1.groundArena[0].playId;
    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0); // Play Shoot First
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyMarinePlayId] }); // Choose attacker
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] }); // Choose target

    // Walker survives but took 4 damage
    const walker = g.state.player2.groundArena.find(u => u.playId === walkerPlayId);
    expect(walker?.damage).toBe(4);
    // Marine is defeated (5 counter-damage > 3 HP) — actually 5 power kills 3 HP marine
    expect(g.state.player1.groundArena.find(u => u.playId === friendlyMarinePlayId)).toBeUndefined();
  });
});
