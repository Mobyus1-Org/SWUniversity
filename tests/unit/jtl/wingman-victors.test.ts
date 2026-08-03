import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

const TIE_TOKEN = "JTL_T01";
const EXPERIENCE = Cards.upgrades.token.experience;

// JTL_084 Wingman Victor Two - Mauler Mithel (3/2 Ground, cost 2; +1/+1 as an upgrade) —
//   "Piloting [1 resource]
//    When played as an upgrade: Create a TIE Fighter token."
// JTL_086 Wingman Victor Three - Backstabber (4/3 Ground, cost 3; +1/+1 as an upgrade) —
//   "Piloting [1 resource]
//    When played as an upgrade: You may give an Experience token to another unit."
describe("Wingman Victor Two / Three — when played as an upgrade", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const ties = (g: GameTestAdapter) => g.state.player1.spaceArena.filter(u => u.cardId === TIE_TOKEN).length;

  describe("JTL_084 Wingman Victor Two", () => {
    it("creates a TIE Fighter token when played as a Pilot upgrade", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .WithCardInHandForPlayer(1, Cards.units.jtl.wingmanVictorTwo)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "Play as Pilot");
      await g.choosePilotVehicleSpaceAsync(1, 0);

      expect(g.state.player1.spaceArena[0].upgrades.some(u => u.cardId === Cards.units.jtl.wingmanVictorTwo)).toBe(true);
      expect(ties(g)).toBe(1);
    });

    it("control: playing him as a UNIT creates no TIE token", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .WithCardInHandForPlayer(1, Cards.units.jtl.wingmanVictorTwo)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "Play as Unit");

      expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.jtl.wingmanVictorTwo)).toBe(true);
      expect(ties(g)).toBe(0);
    });
  });

  describe("JTL_086 Wingman Victor Three", () => {
    it("may give an Experience token to another unit when played as a Pilot upgrade", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithCardInHandForPlayer(1, Cards.units.jtl.wingmanVictorThree)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "Play as Pilot");
      await g.choosePilotVehicleSpaceAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === EXPERIENCE).length).toBe(1);
    });

    it("declining gives no Experience", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithCardInHandForPlayer(1, Cards.units.jtl.wingmanVictorThree)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "Play as Pilot");
      await g.choosePilotVehicleSpaceAsync(1, 0);
      await g.chooseNoAsync(1);

      expect(g.state.player1.groundArena[0].upgrades.length).toBe(0);
    });

    it("cannot give the token to the HOST it just attached to ('another unit')", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithCardInHandForPlayer(1, Cards.units.jtl.wingmanVictorThree)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "Play as Pilot");
      await g.choosePilotVehicleSpaceAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.chooseSpaceUnitAsync(1, 0); // the host TIE

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });

    it("control: playing him as a UNIT offers no Experience prompt", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithCardInHandForPlayer(1, Cards.units.jtl.wingmanVictorThree)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "Play as Unit");

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player1.groundArena[0].upgrades.length).toBe(0);
    });
  });
});
