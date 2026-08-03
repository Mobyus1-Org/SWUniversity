import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";
import { Unit } from "@/server/engine/unit";
import { HasGrit } from "@/server/engine/card-db/keyword-dictionaries.ts/grit";

// LOF_238 Darth Revan's Lightsabers — Upgrade (Item/Weapon/Lightsaber), Villainy, cost 2, +2/+2
//   "Attach to a non-Vehicle unit."
//   "If attached unit is a Sith, it gains Grit."
//
// Test hosts:
//   LOF_081 Sith Legionnaire   — 2/2 Ground, Sith      → gains Grit
//   SOR_?? Battlefield Marine  — 3/3 Ground, non-Sith  → no Grit
//   SOR_119 Reinforcement Walker — Ground VEHICLE      → not a legal attach target
describe("LOF_238 Darth Revan's Lightsabers", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
      .WithActivePlayer(1);
  }

  // Puts the sabers on a freshly-built unit and hands back the live Unit wrapper.
  function withSabersOn(cardId: string, damage = 0) {
    const state = base()
      .WithGroundUnitForPlayer(1, cardId, true, damage)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.lof.darthRevansLightsabers, 1),
      ])
      .Build();

    const g = new GameTestAdapter();
    g.loadNewState(state);
    return { g, unit: Unit.FromInterface(g.state.player1.groundArena[0]) };
  }

  describe("'Attach to a non-Vehicle unit.'", () => {
    it("offers non-Vehicle units and withholds Vehicles", async () => {
      const g = new GameTestAdapter();
      const state = base()
        .WithCardInHandForPlayer(1, Cards.upgrades.lof.darthRevansLightsabers)
        .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire) // non-Vehicle
        .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker) // Vehicle
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      const targets = TargetIds(g);
      expect(targets).toContain(state.player1.groundArena[0].playId);
      expect(targets).not.toContain(state.player1.groundArena[1].playId);
    });

    it("may be attached to an ENEMY non-Vehicle unit — it is not friendly-only", async () => {
      const g = new GameTestAdapter();
      const state = base()
        .WithCardInHandForPlayer(1, Cards.upgrades.lof.darthRevansLightsabers)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      expect(TargetIds(g)).toContain(state.player2.groundArena[0].playId);
    });
  });

  describe("+2/+2", () => {
    it("raises the attached unit's power and HP by 2 each", () => {
      const { unit } = withSabersOn(Cards.units.lof.sithLegionnaire); // 2/2
      expect(unit.CurrentPower()).toBe(4);
      expect(unit.TotalHP()).toBe(4);
    });

    it("control: the same unit without the sabers is 2/2", () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire).Build());
      const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
      expect(unit.CurrentPower()).toBe(2);
      expect(unit.TotalHP()).toBe(2);
    });
  });

  describe("'If attached unit is a Sith, it gains Grit.'", () => {
    it("grants Grit to a Sith host", () => {
      const { unit } = withSabersOn(Cards.units.lof.sithLegionnaire);
      expect(HasGrit(unit.cardId, unit.playId, 1)).toBe(true);
    });

    it("Grit is live in combat math: +1 power per damage counter", () => {
      // Sith Legionnaire 2/2, +2/+2 from the sabers = 4/4, carrying 2 damage.
      const { unit } = withSabersOn(Cards.units.lof.sithLegionnaire, 2);
      expect(unit.CurrentPower()).toBe(6); // 2 base + 2 sabers + 2 Grit
    });

    it("control: a non-Sith host gains no Grit", () => {
      const { unit } = withSabersOn(Cards.units.sor.battlefieldMarine);
      expect(HasGrit(unit.cardId, unit.playId, 1)).toBe(false);
    });

    it("control: a damaged non-Sith host gets the +2 but no damage bonus", () => {
      // Battlefield Marine 3/3, +2/+2 = 5/5, carrying 2 damage — still 5 power.
      const { unit } = withSabersOn(Cards.units.sor.battlefieldMarine, 2);
      expect(unit.CurrentPower()).toBe(5);
    });
  });
});
