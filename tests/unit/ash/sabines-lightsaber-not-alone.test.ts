import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_114 Sabine's Lightsaber — Not Alone. Cost 2 Command/Heroism Item/Weapon/Lightsaber, unique.
//   "Attach to a non-Vehicle unit.
//    If attached unit is Sabine Wren or a Force unit, it gains Restore 2."
//
// The grant has TWO independent triggers — the host's TITLE, or the Force trait. A Sabine Wren
// with no Force trait must still get Restore, so the title branch is tested on its own.

const SABER = Cards.upgrades.ash.sabinesLightsaber;
const SABINE = Cards.units.law.sabineWren;              // 3/3, Mandalorian/Rebel/Spectre — no Force
const FORCE_UNIT = Cards.units.sor.guardianOfTheWhills; // 2/2 Force
const VEHICLE = Cards.units.sor.escortSkiff;            // 4/4 Vehicle Speeder
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3, neither Sabine nor Force

/** Base starts on 5 damage so a Restore 2 is visible as a drop to 3. */
function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

/** Attacks the enemy base with player 1's only ground unit and reports their own base damage. */
async function attackAndReadOwnBase(g: GameTestAdapter): Promise<number> {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
  return g.state.player1.base.damage;
}

describe("ASH_114 Sabine's Lightsaber — Not Alone", () => {
  describe("Restore 2 grant", () => {
    it("grants Restore 2 to a FORCE unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, FORCE_UNIT)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SABER, 1)])
          .Build(),
      );

      expect(await attackAndReadOwnBase(g)).toBe(3);
    });

    it("grants Restore 2 to SABINE WREN even without the Force trait", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, SABINE)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SABER, 1)])
          .Build(),
      );

      expect(await attackAndReadOwnBase(g)).toBe(3);
    });

    it("grants nothing to a host that is neither", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SABER, 1)])
          .Build(),
      );

      expect(await attackAndReadOwnBase(g)).toBe(5);
    });

    it("control: the same Force host WITHOUT the saber restores nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(1, FORCE_UNIT).Build());

      expect(await attackAndReadOwnBase(g)).toBe(5);
    });
  });

  describe("attach restriction", () => {
    it("cannot attach to a Vehicle", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, VEHICLE)
          .WithGroundUnitForPlayer(1, MARINE)
          .WithCardInHandForPlayer(1, SABER)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      const res = g.lastDispatchResponse?.resolutionNeeded;
      const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
      const vehicle = g.state.player1.groundArena.find(u => u.cardId === VEHICLE)!;
      const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
      expect(offered).not.toContain(vehicle.playId);
      expect(offered).toContain(marine.playId);
    });

    it("attaches to an enemy non-Vehicle unit too — the text names no controller", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(2, MARINE)
          .WithCardInHandForPlayer(1, SABER)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      const res = g.lastDispatchResponse?.resolutionNeeded;
      const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
      expect(offered).toContain(g.state.player2.groundArena[0].playId);
    });
  });
});
