import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// LOF_261 Constructed Lightsaber — Upgrade (Item/Weapon/Lightsaber), cost 3
// "Attach to a Force unit."
// "If attached unit is a Heroism unit, it gains Restore 2."
// "If attached unit is a Villainy unit, it gains Raid 2."
// "If attached unit is a non-Heroism, non-Villainy unit, it gains Sentinel."
//
// Test units, chosen for their aspects:
//   LOF_048 Itinerant Warrior      — Vigilance/Heroism, Force  → Restore 2
//   LOF_231 Darth Tyranus          — Villainy, Force           → Raid 2
//   LOF_072 Priestesses of the Force — Vigilance (neither), Force → Sentinel
//   SOR_?? Battlefield Marine      — non-Force                 → not a legal attach target

function withSaberOn(cardId: string) {
  const state = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithGroundUnitForPlayer(1, cardId)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [
      GameStateBuilder.Upgrade(Cards.upgrades.lof.constructedLightsaber, 1),
    ])
    .Build();

  const g = new GameTestAdapter();
  g.loadNewState(state);

  return { g, unit: state.player1.groundArena[0] };
}

describe("LOF_261 Constructed Lightsaber", () => {
  describe("attach restriction — 'Attach to a Force unit.'", () => {
    it("offers only Force units as attach targets", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.upgrades.lof.constructedLightsaber)
        .WithGroundUnitForPlayer(1, Cards.units.lof.darthTyranus) // Force
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // NOT Force
        .Build();
      g.loadNewState(state);

      const forceUnitPlayId = state.player1.groundArena[0].playId;
      const nonForcePlayId = state.player1.groundArena[1].playId;

      await g.playCardFromHandAsync(1, 0);

      const targets = TargetIds(g);
      expect(targets).toContain(forceUnitPlayId);
      expect(targets).not.toContain(nonForcePlayId);
    });
  });

  describe("'If attached unit is a Heroism unit, it gains Restore 2.'", () => {
    it("grants Restore 2 to a Heroism Force unit", () => {
      const { unit } = withSaberOn(Cards.units.lof.itinerantWarrior);
      expect(RestoreAmount(unit.cardId, unit.playId, 1)).toBe(2);
    });

    it("does not also grant Raid or Sentinel to a Heroism unit", () => {
      const { unit } = withSaberOn(Cards.units.lof.itinerantWarrior);
      expect(RaidAmount(unit.cardId, unit.playId, 1)).toBe(0);
      expect(HasSentinel(unit.cardId, unit.playId, 1)).toBe(false);
    });
  });

  describe("'If attached unit is a Villainy unit, it gains Raid 2.'", () => {
    it("grants Raid 2 to a Villainy Force unit", () => {
      const { unit } = withSaberOn(Cards.units.lof.darthTyranus);
      expect(RaidAmount(unit.cardId, unit.playId, 1)).toBe(2);
    });

    it("does not also grant Restore or Sentinel to a Villainy unit", () => {
      const { unit } = withSaberOn(Cards.units.lof.darthTyranus);
      expect(RestoreAmount(unit.cardId, unit.playId, 1)).toBe(0);
      expect(HasSentinel(unit.cardId, unit.playId, 1)).toBe(false);
    });
  });

  describe("'If attached unit is a non-Heroism, non-Villainy unit, it gains Sentinel.'", () => {
    it("grants Sentinel to a Force unit with neither aspect", () => {
      const { unit } = withSaberOn(Cards.units.lof.priestessesOfTheForce);
      expect(HasSentinel(unit.cardId, unit.playId, 1)).toBe(true);
    });

    it("does not also grant Raid or Restore to a neutral unit", () => {
      const { unit } = withSaberOn(Cards.units.lof.priestessesOfTheForce);
      expect(RaidAmount(unit.cardId, unit.playId, 1)).toBe(0);
      expect(RestoreAmount(unit.cardId, unit.playId, 1)).toBe(0);
    });

    // Regression: HasSentinel's upgrade loop assigned rather than OR'd, so a later upgrade
    // whose own Sentinel condition was false could erase the Sentinel this card granted.
    it("keeps Sentinel when a Jarek Yeager upgrade with an unmet condition sits after it", () => {
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithGroundUnitForPlayer(1, Cards.units.lof.priestessesOfTheForce)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.lof.constructedLightsaber, 1),
          // Jarek Yeager only grants Sentinel with units in BOTH arenas; there is no space
          // unit here, so his condition is false and must not clobber the saber's Sentinel.
          GameStateBuilder.Upgrade(Cards.upgrades.jtl.jarekYeager, 1),
        ])
        .Build();

      const g = new GameTestAdapter();
      g.loadNewState(state);

      const unit = state.player1.groundArena[0];
      expect(HasSentinel(unit.cardId, unit.playId, 1)).toBe(true);
    });
  });
});
