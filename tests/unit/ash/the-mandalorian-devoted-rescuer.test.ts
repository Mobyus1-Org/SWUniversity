import { beforeEach, describe, expect, it } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { CommonSetup } from "../../test-helpers";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

/**
 * ASH_062 The Mandalorian — Devoted Rescuer. 5/4 Ground, unique, Mandalorian.
 *
 *   "Shielded
 *    If damage would be dealt to another friendly unit, you may defeat a Shield token on this
 *    unit. If you do, prevent that damage."
 *
 * The rider is a REPLACEMENT effect: it interposes before the damage lands, on every source of
 * damage to a friendly unit — combat, counter-damage and card abilities alike. Its restrictions
 * are what most of these cases pin down: "another" (never himself), "friendly" (never an enemy),
 * "unit" (never a base), and "a Shield token ON THIS UNIT" (another unit's Shield will not do).
 */

const MANDO = Cards.units.ash.theMandalorianDevotedRescuer;
const SHIELD = Cards.upgrades.token.shield;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground, no abilities
const WAMPA = Cards.units.sor.wampa;                    // 4/5 Ground
const OPEN_FIRE = Cards.events.sor.openFire;            // "Deal 4 damage to a unit"

const shield = () => GameStateBuilder.Upgrade(SHIELD, 1);
const shieldFor = (p: 1 | 2) => GameStateBuilder.Upgrade(SHIELD, p);

function base(): GameStateBuilder {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

/** The index of a unit in a player's ground arena, by cardId. */
function idx(g: GameTestAdapter, player: 1 | 2, cardId: string): number {
  const arena = player === 1 ? g.state.player1.groundArena : g.state.player2.groundArena;
  return arena.findIndex(u => u.cardId === cardId);
}

/**
 * Targets a unit by cardId in EITHER player's arena. The adapter's chooseGroundUnitAsync indexes
 * the dispatcher's own arena, so it cannot express "P1 targets a unit P2 controls".
 */
function target(g: GameTestAdapter, from: 1 | 2, owner: 1 | 2, cardId: string) {
  const arena = owner === 1 ? g.state.player1.groundArena : g.state.player2.groundArena;
  const found = arena.find(u => u.cardId === cardId);
  if (!found) throw new Error(`no ${cardId} in player ${owner}'s ground arena`);
  return g.dispatchAsync(from, "choose-target", { targetPlayIds: [found.playId] });
}

function unit(g: GameTestAdapter, player: 1 | 2, cardId: string) {
  const arena = player === 1 ? g.state.player1.groundArena : g.state.player2.groundArena;
  return arena.find(u => u.cardId === cardId);
}

function shieldCount(g: GameTestAdapter, player: 1 | 2, cardId: string): number {
  return unit(g, player, cardId)?.upgrades.filter(u => u.cardId === SHIELD).length ?? 0;
}

describe("ASH_062 The Mandalorian — Devoted Rescuer", () => {
  let g: GameTestAdapter;

  beforeEach(() => {
    g = new GameTestAdapter();
  });

  describe("combat damage to another friendly unit", () => {
    /**
     * P1's 3/7 attacks P2's 3/7; P2 also controls a shielded Mandalorian. Both combatants are
     * 3/7 so each survives the other's 3 damage and can still be asserted on afterwards.
     */
    function combat(): GameStateBuilder {
      return base()
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, MANDO)
        .WithUpgradesOnGroundUnitForPlayer(2, 1, [shieldFor(2)]);
    }

    it("prevents the combat damage and defeats one Shield when accepted", async () => {
      g.loadNewState(combat().Build());
      await g.attackWithGroundUnitAsync(1, idx(g, 1, SECURITY));
      await target(g, 1, 2, SECURITY);
      await g.chooseYesAsync(2);

      expect(unit(g, 2, SECURITY)!.damage).toBe(0);
      expect(shieldCount(g, 2, MANDO)).toBe(0);
    });

    it("lets the damage land in full and keeps the Shield when declined", async () => {
      g.loadNewState(combat().Build());
      await g.attackWithGroundUnitAsync(1, idx(g, 1, SECURITY));
      await target(g, 1, 2, SECURITY);
      await g.chooseNoAsync(2);

      expect(unit(g, 2, SECURITY)!.damage).toBe(3);
      expect(shieldCount(g, 2, MANDO)).toBe(1);
    });

    it("does not stop the defender's counter-damage — only the damage TO the friendly unit", async () => {
      g.loadNewState(combat().Build());
      await g.attackWithGroundUnitAsync(1, idx(g, 1, SECURITY));
      await target(g, 1, 2, SECURITY);
      await g.chooseYesAsync(2);

      expect(unit(g, 1, SECURITY)!.damage).toBe(3);
    });

    it("protects the ATTACKER from counter-damage too", async () => {
      // "another friendly unit" is not limited to defenders — a friendly attacker taking counter
      // damage is the same replacement.
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, MANDO)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [shield()])
          .WithGroundUnitForPlayer(1, SECURITY)
          .WithGroundUnitForPlayer(2, WAMPA)
          .Build(),
      );
      await g.attackWithGroundUnitAsync(1, idx(g, 1, SECURITY));
      await target(g, 1, 2, WAMPA);
      await g.chooseYesAsync(1);

      expect(unit(g, 1, SECURITY)!.damage).toBe(0);
      expect(shieldCount(g, 1, MANDO)).toBe(0);
      expect(unit(g, 2, WAMPA)!.damage).toBe(3);
    });

    it("offers nothing when The Mandalorian holds no Shield", async () => {
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, SECURITY)
          .WithGroundUnitForPlayer(2, SECURITY)
          .WithGroundUnitForPlayer(2, MANDO)
          .Build(),
      );
      await g.attackWithGroundUnitAsync(1, idx(g, 1, SECURITY));
      await target(g, 1, 2, SECURITY);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(unit(g, 2, SECURITY)!.damage).toBe(3);
    });

    it("does not fire for damage to HIMSELF — his own Shielded absorbs it", async () => {
      // "another friendly unit" excludes The Mandalorian, so there is no prompt and no chance to
      // spend the Shield twice: it is consumed as ordinary Shield absorption.
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, SECURITY)
          .WithGroundUnitForPlayer(2, MANDO)
          .WithUpgradesOnGroundUnitForPlayer(2, 0, [shieldFor(2)])
          .Build(),
      );
      await g.attackWithGroundUnitAsync(1, idx(g, 1, SECURITY));
      await target(g, 1, 2, MANDO);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(unit(g, 2, MANDO)!.damage).toBe(0);
      expect(shieldCount(g, 2, MANDO)).toBe(0);
    });

    it("does not fire for damage to a BASE", async () => {
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, SECURITY)
          .WithGroundUnitForPlayer(2, MANDO)
          .WithUpgradesOnGroundUnitForPlayer(2, 0, [shieldFor(2)])
          .Build(),
      );
      await g.attackWithGroundUnitAsync(1, idx(g, 1, SECURITY));
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(3);
      expect(shieldCount(g, 2, MANDO)).toBe(1);
    });
  });

  describe("ability damage", () => {
    /** P1 plays Open Fire (deal 4 to a unit) with a shielded Mandalorian of their own in play. */
    function withOpenFire(): GameStateBuilder {
      return base()
        .WithGroundUnitForPlayer(1, MANDO)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [shield()])
        .WithCardInHandForPlayer(1, OPEN_FIRE)
        .FillResourcesForPlayer(1, MARINE, 14);
    }

    it("prevents ability damage to another friendly unit", async () => {
      g.loadNewState(withOpenFire().WithGroundUnitForPlayer(1, SECURITY).Build());
      await g.playCardFromHandAsync(1, 0);
      await target(g, 1, 1, SECURITY);
      await g.chooseYesAsync(1);

      expect(unit(g, 1, SECURITY)!.damage).toBe(0);
      expect(shieldCount(g, 1, MANDO)).toBe(0);
    });

    it("lets it land when declined", async () => {
      g.loadNewState(withOpenFire().WithGroundUnitForPlayer(1, SECURITY).Build());
      await g.playCardFromHandAsync(1, 0);
      await target(g, 1, 1, SECURITY);
      await g.chooseNoAsync(1);

      expect(unit(g, 1, SECURITY)!.damage).toBe(4);
      expect(shieldCount(g, 1, MANDO)).toBe(1);
    });

    it("still lets the DECLINED damage be absorbed by the target's own Shield", async () => {
      // On decline the instance must resume in the target's own frame — its Shield pops and it
      // takes nothing. Losing the instance entirely, or applying it past the Shield, are both wrong.
      g.loadNewState(
        withOpenFire()
          .WithGroundUnitForPlayer(1, SECURITY)
          .WithUpgradesOnGroundUnitForPlayer(1, 1, [shield()])
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);
      await target(g, 1, 1, SECURITY);
      await g.chooseNoAsync(1);

      expect(unit(g, 1, SECURITY)!.damage).toBe(0);
      expect(shieldCount(g, 1, SECURITY)).toBe(0);
      expect(shieldCount(g, 1, MANDO)).toBe(1);
    });

    it("defeats exactly ONE Shield when The Mandalorian carries several", async () => {
      g.loadNewState(
        withOpenFire()
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [shield(), shield()])
          .WithGroundUnitForPlayer(1, SECURITY)
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);
      await target(g, 1, 1, SECURITY);
      await g.chooseYesAsync(1);

      expect(unit(g, 1, SECURITY)!.damage).toBe(0);
      expect(shieldCount(g, 1, MANDO)).toBe(1);
    });

    it("does not fire for damage to an ENEMY unit", async () => {
      g.loadNewState(withOpenFire().WithGroundUnitForPlayer(2, WAMPA).Build());
      await g.playCardFromHandAsync(1, 0);
      await target(g, 1, 2, WAMPA);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(unit(g, 2, WAMPA)!.damage).toBe(4);
      expect(shieldCount(g, 1, MANDO)).toBe(1);
    });

    it("needs the Shield on THE MANDALORIAN — another friendly unit's Shield will not do", async () => {
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, MANDO)
          .WithGroundUnitForPlayer(1, WAMPA)
          .WithGroundUnitForPlayer(1, SECURITY)
          .WithUpgradesOnGroundUnitForPlayer(1, 2, [shield()])
          .WithCardInHandForPlayer(1, OPEN_FIRE)
          .FillResourcesForPlayer(1, MARINE, 14)
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);
      await target(g, 1, 1, WAMPA);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(unit(g, 1, WAMPA)!.damage).toBe(4);
      expect(shieldCount(g, 1, SECURITY)).toBe(1);
    });

    it("fires when the OPPONENT is the source and the Mandalorian's controller is not active", async () => {
      g.loadNewState(
        base()
          .WithActivePlayer(2)
          .WithGroundUnitForPlayer(1, MANDO)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [shield()])
          .WithGroundUnitForPlayer(1, SECURITY)
          .WithCardInHandForPlayer(2, OPEN_FIRE)
          .FillResourcesForPlayer(2, MARINE, 14)
          .Build(),
      );
      await g.playCardFromHandAsync(2, 0);
      await target(g, 2, 1, SECURITY);
      await g.chooseYesAsync(1);

      expect(unit(g, 1, SECURITY)!.damage).toBe(0);
      expect(shieldCount(g, 1, MANDO)).toBe(0);
    });
  });

  it("does not intercept INDIRECT damage — it is unpreventable and assigned, not dealt", async () => {
    // Indirect damage is applied by the assignment handler, never through the damage helper the
    // rider hooks. This pins the ruling: routing indirect through that helper later would silently
    // make it preventable.
    const g2 = new GameTestAdapter();
    g2.loadNewState(
      CommonSetup(new GameStateBuilder(), "yyw", "yyk")
        .WithActivePlayer(2)
        .WithInitiativePlayerBeing(2)
        .FillResourcesForPlayer(2, MARINE, 3)
        .WithCardInHandForPlayer(2, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(1, MANDO)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [shield()])
        .WithGroundUnitForPlayer(1, SECURITY)
        .Build(),
    );
    await g2.playCardFromHandAsync(2, 0);
    await g2.dispatchAsync(2, "choose-option", { option: "Opponent" });
    const victim = g2.state.player1.groundArena.find(u => u.cardId === SECURITY)!;
    await g2.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: victim.playId, damage: 5 },
      ],
    });

    expect(unit(g2, 1, SECURITY)!.damage).toBe(5);
    expect(shieldCount(g2, 1, MANDO)).toBe(1);
  });

  it("keeps its own Shielded keyword — it enters play with a Shield token", async () => {
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, MANDO)
        .FillResourcesForPlayer(1, MARINE, 14)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);

    expect(shieldCount(g, 1, MANDO)).toBe(1);
  });
});
