import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_067 Fenn Rau - Protector of Concord Dawn (5/6 Ground, cost 6) —
//   "When Played: You may play an upgrade from your hand. It costs 2 resources less.
//    When you play an upgrade on this unit: Give an enemy unit –2/–2 for this phase."
describe("SHD_067 Fenn Rau - Protector of Concord Dawn", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  describe("When Played: play an upgrade for 2 less", () => {
    it("plays the chosen upgrade at a 2-resource discount", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // attach target
          .WithCardInHandForPlayer(1, Cards.units.shd.fennRau)
          .WithCardInHandForPlayer(1, Cards.upgrades.sor.jediLightsaber) // cost 3 → 1 after discount
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.chooseCardFromHandAsync(1, 0); // the Lightsaber (Fenn Rau already left hand)
      await g.chooseGroundUnitAsync(1, 0);   // attach to the Marine

      // 6 for Fenn Rau + (3 − 2) for the Lightsaber = 7. Undiscounted it would be 9.
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(7);
      expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === Cards.upgrades.sor.jediLightsaber)).toBe(true);
    });

    it("declining plays no upgrade", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithCardInHandForPlayer(1, Cards.units.shd.fennRau)
          .WithCardInHandForPlayer(1, Cards.upgrades.sor.jediLightsaber)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1);

      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(6);
      expect(g.state.player1.groundArena[0].upgrades.length).toBe(0);
      expect(g.state.player1.hand.some(c => c.cardId === Cards.upgrades.sor.jediLightsaber)).toBe(true);
    });

    it("no prompt at all with no upgrade in hand", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithCardInHandForPlayer(1, Cards.units.shd.fennRau)
          .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // a unit, not an upgrade
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });

    it("rejects a non-upgrade choice", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithCardInHandForPlayer(1, Cards.units.shd.fennRau)
          .WithCardInHandForPlayer(1, Cards.upgrades.sor.jediLightsaber)
          .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.chooseCardFromHandAsync(1, 1); // Echo Base Defender — a Unit

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });
  });

  describe("When you play an upgrade on this unit: enemy gets -2/-2", () => {
    it("debuffs a chosen enemy unit when an upgrade lands on Fenn Rau", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.fennRau)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9
          .WithCardInHandForPlayer(1, Cards.upgrades.sor.jediLightsaber)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0); // attach to Fenn Rau
      await g.chooseGroundUnitAsync(2, 0); // debuff the Walker

      const walker = Unit.FromInterface(g.state.player2.groundArena[0]);
      expect(walker.CurrentPower()).toBe(4); // 6 - 2
      expect(walker.TotalHP()).toBe(7);      // 9 - 2
    });

    it("does NOT trigger when the upgrade goes on a different unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.fennRau)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .WithCardInHandForPlayer(1, Cards.upgrades.sor.jediLightsaber)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 1); // attach to the Marine instead

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(6);
    });

    it("does NOT trigger when the OPPONENT plays an upgrade on him", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.fennRau)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithCardInHandForPlayer(2, Cards.upgrades.shd.frozenInCarbonite)
          .WithActivePlayer(2)
          .Build(),
      );

      await g.playCardFromHandAsync(2, 0);
      await g.chooseGroundUnitAsync(1, 0); // opponent attaches to Fenn Rau

      // "When YOU play an upgrade" — the opponent's play is not Fenn Rau's controller's.
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(Unit.FromInterface(g.state.player1.groundArena[1]).CurrentPower()).toBe(3);
    });

    it("does NOT trigger off a token upgrade (given, not played)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.fennRau)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .WithCardInHandForPlayer(1, Cards.units.sor.wingLeader) // gives 2 XP to another Rebel
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      // Fenn Rau is not a Rebel, so Wing Leader finds no target — but crucially no debuff prompt.
      expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(6);
    });

    it("the When Played upgrade landing on Fenn Rau himself chains into the debuff", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .WithCardInHandForPlayer(1, Cards.units.shd.fennRau)
          .WithCardInHandForPlayer(1, Cards.upgrades.sor.jediLightsaber)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.chooseCardFromHandAsync(1, 0); // the Lightsaber
      await g.chooseGroundUnitAsync(1, 0);   // onto Fenn Rau (the only friendly unit)
      await g.chooseGroundUnitAsync(2, 0);   // debuff the Walker

      expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(4);
    });
  });
});
