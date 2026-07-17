import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_179 Boba Fett's Rancor (Ground, cost 8, 8/9) —
//   "When Played: Deal 5 damage to your base. Then, deal 5 damage to an enemy ground unit. Then,
//    deal 5 damage to the same unit."
//   "On Attack: You may deal 1 damage to a base for every 5 damage on your base."
//
// Homestead Militia (SOR_113, 4 HP) dies to the FIRST 5-damage hit, so step (c) has no legal
// target and must fizzle silently (no re-prompt, no crash). SHD_050 Chewbacca (Pykesbane) is the
// highest-HP Ground unit in the pool at 10 HP — it survives the first hit but is defeated by the
// combined 10 damage; no Ground unit in the card pool has more than 10 HP, so a "survives both
// hits" case isn't reachable with real card data.

describe("ASH_179 Boba Fett's Rancor — When Played", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.ash.bobaFettsRancor);
  }

  it("deals 5 damage to own base and 10 total to the chosen enemy ground unit, defeating it", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, Cards.units.shd.chewbaccaPykesbane) // 10 HP
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player2.groundArena.some(u => u.playId === targetPlayId)).toBe(false); // defeated
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.shd.chewbaccaPykesbane)).toBe(true);
  });

  it("fizzles the third clause silently when the target already died from the second hit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, Cards.units.sor.homesteadMilitia) // 4 HP — dies to the first 5
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const resp = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    // No crash, no re-prompt for a new target — the ability just finished.
    expect(resp.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player2.groundArena.some(u => u.playId === targetPlayId)).toBe(false); // defeated
  });

  it("still deals base damage with no enemy ground unit to target — no crash, no unit prompt", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(2, Cards.units.ash.gozantiAssaultCarrier) // enemy exists, but not Ground
      .Build();
    g.loadNewState(state);

    const resp = await g.playCardFromHandAsync(1, 0);

    expect(resp.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.base.damage).toBe(5);
  });
});

describe("ASH_179 Boba Fett's Rancor — On Attack", () => {
  function base() {
    return new GameStateBuilder()
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
  }

  it("offers floor(baseDamage/5) damage to a chosen base when the base has damage", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .MyBase(Cards.bases.common.green30HP, 12) // floor(12/5) = 2
      .WithGroundUnitForPlayer(1, Cards.units.ash.bobaFettsRancor)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2); // deal the 2 damage to the enemy base

    expect(g.state.player2.base.damage).toBe(10); // 2 from the ability + 8 combat (8 power)
  });

  it("may decline the On Attack ability — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .MyBase(Cards.bases.common.green30HP, 12)
      .WithGroundUnitForPlayer(1, Cards.units.ash.bobaFettsRancor)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(8); // combat damage only (8 power)
  });

  it("does not prompt at all when the base has no damage", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .MyBase(Cards.bases.common.green30HP, 0)
      .WithGroundUnitForPlayer(1, Cards.units.ash.bobaFettsRancor)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    const resp = await g.chooseBaseAsync(1, 2);

    // Combat resolves straight through — no ability-option prompt for ASH_179's On Attack.
    expect(resp.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(8); // just the combat damage from the attack (8 power)
  });
});
