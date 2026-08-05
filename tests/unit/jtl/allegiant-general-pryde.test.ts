import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_133 Allegiant General Pryde (2/3 Ground, cost 2, unique, First Order/Official) —
//   "When indirect damage is dealt to a unit: You may defeat a non-unique upgrade on it.
//    On Attack: If you have the initiative, deal 2 indirect damage to a player."
describe("JTL_133 Allegiant General Pryde", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
      .WithActivePlayer(1);
  }

  describe("On Attack: if you have the initiative, deal 2 indirect damage", () => {
    it("fires when you hold the initiative", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithInitiativePlayerBeing(1)
          .WithGroundUnitForPlayer(1, Cards.units.jtl.allegiantGeneralPryde)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

      // 2 from Pryde's power, plus the 2 indirect auto-assigned (opponent has no units).
      expect(g.state.player2.base.damage).toBe(4);
    });

    it("control: does nothing without the initiative", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithInitiativePlayerBeing(2)
          .WithGroundUnitForPlayer(1, Cards.units.jtl.allegiantGeneralPryde)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(2); // combat damage only
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });
  });

  describe("When indirect damage is dealt to a unit: may defeat a non-unique upgrade", () => {
    /** P1 has Pryde; P1 Torpedo Barrages the opponent, who has an upgraded unit. */
    function boardWithUpgrade(upgradeCardId: string) {
      const s = base()
        .WithInitiativePlayerBeing(2) // keep Pryde's On Attack out of the way
        .WithGroundUnitForPlayer(1, Cards.units.jtl.allegiantGeneralPryde)
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(upgradeCardId, 2)])
        .Build();
      const g = new GameTestAdapter();
      g.loadNewState(s);
      return { g, victimPlayId: s.player2.groundArena[0].playId };
    }

    it("offers, and defeats the chosen upgrade", async () => {
      const { g, victimPlayId } = boardWithUpgrade(Cards.upgrades.sor.jediLightsaber); // non-unique

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await g.dispatchAsync(2, "choose-target", {
        spreadDamageAssignments: [{ playId: victimPlayId, damage: 5 }],
      });

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // Pryde's prompt
      await g.chooseYesAsync(1);
      await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0, 0);

      expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    });

    it("declining leaves the upgrade alone", async () => {
      const { g, victimPlayId } = boardWithUpgrade(Cards.upgrades.sor.jediLightsaber);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await g.dispatchAsync(2, "choose-target", {
        spreadDamageAssignments: [{ playId: victimPlayId, damage: 5 }],
      });
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseNoAsync(1);

      expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
    });

    it("does not offer for a UNIQUE upgrade", async () => {
      const { g, victimPlayId } = boardWithUpgrade(Cards.upgrades.sor.lukesLightsaber); // unique

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await g.dispatchAsync(2, "choose-target", {
        spreadDamageAssignments: [{ playId: victimPlayId, damage: 5 }],
      });

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
    });

    it("control: without Pryde, nothing is offered", async () => {
      const s = base()
        .WithInitiativePlayerBeing(2)
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.sor.jediLightsaber, 2),
        ])
        .Build();
      const g = new GameTestAdapter();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await g.dispatchAsync(2, "choose-target", {
        spreadDamageAssignments: [{ playId: s.player2.groundArena[0].playId, damage: 5 }],
      });

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
    });

    it("a unit the indirect damage DEFEATED offers nothing — its upgrades went with it", async () => {
      const s = base()
        .WithInitiativePlayerBeing(2)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.allegiantGeneralPryde)
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1/1
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.sor.jediLightsaber, 2), // +3/+3 → 4/4
        ])
        .Build();
      const g = new GameTestAdapter();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      // 4 is exactly its remaining HP (the cap), so it dies and the last point goes to the base.
      await g.dispatchAsync(2, "choose-target", {
        spreadDamageAssignments: [
          { playId: s.player2.groundArena[0].playId, damage: 4 },
          { playId: "player2.base", damage: 1 },
        ],
      });

      expect(g.state.player2.groundArena).toHaveLength(0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });
  });
});
