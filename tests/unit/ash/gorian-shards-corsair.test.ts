import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_196 Gorian Shard's Corsair (Space, cost 6, 6/5, Underworld/Vehicle/Capital Ship) —
//   "Damage dealt by friendly Underworld cards is unpreventable."
//   "When Played/On Attack: You may deal 2 damage to a unit."
//
// Boba Fett's Rancor (ASH_179) is Underworld and used as the "friendly Underworld attacker" in
// the static-rule tests. SHD_050 (10 HP, the highest-HP Ground unit in the pool) is the shielded
// defender so it survives Rancor's 8 power and its damage/Shield state can both be inspected.

function shield(owner: 1 | 2) {
  return { cardId: Cards.upgrades.token.shield, playId: "@", owner, controller: owner };
}

describe("ASH_196 Gorian Shard's Corsair — unpreventable Underworld damage", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
  }

  it("a friendly Underworld unit's combat damage is not prevented by an enemy Shield token", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.gorianShardsCorsair)
      .WithGroundUnitForPlayer(1, Cards.units.ash.bobaFettsRancor) // Underworld, 8 power
      .WithGroundUnitForPlayer(2, Cards.units.shd.chewbaccaPykesbane) // 10 HP
      .Build();
    g.loadNewState(state);
    state.player2.groundArena[0].upgrades.push(shield(2));
    const attackerIdx = state.player1.groundArena.findIndex(u => u.cardId === Cards.units.ash.bobaFettsRancor);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, attackerIdx);
    await g.chooseGroundUnitAsync(2, 0);

    const defender = g.state.player2.groundArena.find(u => u.playId === defenderPlayId)!;
    expect(defender.damage).toBe(8); // full combat damage went through, unprevented
    expect(defender.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(true); // Shield never triggered — still there
  });

  it("control: a friendly non-Underworld unit's damage is still preventable by a Shield token", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.gorianShardsCorsair)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not Underworld
      .WithGroundUnitForPlayer(2, Cards.units.shd.chewbaccaPykesbane)
      .Build();
    g.loadNewState(state);
    state.player2.groundArena[0].upgrades.push(shield(2));
    const attackerIdx = state.player1.groundArena.findIndex(u => u.cardId === Cards.units.sor.battlefieldMarine);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, attackerIdx);
    await g.chooseGroundUnitAsync(2, 0);

    const defender = g.state.player2.groundArena.find(u => u.playId === defenderPlayId)!;
    expect(defender.damage).toBe(0); // Shield absorbed it
    expect(defender.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(false); // Shield consumed
  });

  it("an enemy Underworld unit's damage is not made unpreventable — Corsair must be friendly", async () => {
    const g = new GameTestAdapter();
    // Player 1 controls the Corsair; Player 2 controls the Underworld attacker. Player 2's
    // Underworld damage should NOT bypass Player 1's Shield, because Corsair isn't Player 2's.
    const state = base()
      .WithActivePlayer(2)
      .WithSpaceUnitForPlayer(1, Cards.units.ash.gorianShardsCorsair)
      .WithGroundUnitForPlayer(2, Cards.units.ash.bobaFettsRancor) // enemy Underworld attacker
      .WithGroundUnitForPlayer(1, Cards.units.shd.chewbaccaPykesbane)
      .Build();
    g.loadNewState(state);
    state.player1.groundArena[0].upgrades.push(shield(1));
    const defenderPlayId = state.player1.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const defender = g.state.player1.groundArena.find(u => u.playId === defenderPlayId)!;
    expect(defender.damage).toBe(0); // Shield absorbed it — normal prevention applies
    expect(defender.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(false);
  });
});

describe("ASH_196 Gorian Shard's Corsair — When Played: may deal 2 damage to a unit", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.ash.gorianShardsCorsair);
  }

  it("accepting deals 2 damage to the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker) // 5 HP — survives
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena.find(u => u.playId === targetPlayId)?.damage).toBe(2);
  });

  it("may decline — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker)
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena.find(u => u.playId === targetPlayId)?.damage).toBe(0);
  });
});

describe("ASH_196 Gorian Shard's Corsair — On Attack: may deal 2 damage to a unit", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
  }

  it("accepting deals 2 damage to the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.gorianShardsCorsair)
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker) // bystander target, 5 HP
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena.find(u => u.playId === targetPlayId)?.damage).toBe(2);
  });

  it("may decline — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.gorianShardsCorsair)
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker)
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena.find(u => u.playId === targetPlayId)?.damage).toBe(0);
  });

  it("fires again on a second attack", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.gorianShardsCorsair)
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker)
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena.find(u => u.playId === targetPlayId)?.damage).toBe(2);

    // Hand the action back to player 1 and ready the Corsair for a second attack.
    await g.dispatchAsync(2, "pass-action", {});
    const corsair = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.gorianShardsCorsair)!;
    corsair.ready = true;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena.find(u => u.playId === targetPlayId)?.damage).toBe(4);
  });
});
