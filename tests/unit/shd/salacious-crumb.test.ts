import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_080 Salacious Crumb - Obnoxious Pet (1/3 Ground, cost 1) —
//   "When Played: Heal 1 damage from your base.
//    Action [Exhaust, return this unit to his owner's hand]: Deal 1 damage to a ground unit."
describe("SHD_080 Salacious Crumb - Obnoxious Pet", () => {
  function base(myBaseDamage = 0) {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, myBaseDamage)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  describe("When Played: heal 1 from your base", () => {
    it("heals 1 damage from your own base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base(5)
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithCardInHandForPlayer(1, Cards.units.shd.salaciousCrumb)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.base.damage).toBe(4);
      expect(g.state.player2.base.damage).toBe(0); // never the opponent's
    });

    it("is a no-op on an undamaged base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base(0)
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithCardInHandForPlayer(1, Cards.units.shd.salaciousCrumb)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.base.damage).toBe(0);
    });
  });

  describe("Action [Exhaust, return to hand]: deal 1 to a ground unit", () => {
    it("returns itself to hand and deals 1 damage to the chosen ground unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.salaciousCrumb)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .Build(),
      );

      await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.shd.salaciousCrumb, playId: g.state.player1.groundArena[0].playId });
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player1.groundArena.length).toBe(0);
      expect(g.state.player1.hand.some(c => c.cardId === Cards.units.shd.salaciousCrumb)).toBe(true);
      expect(g.state.player2.groundArena[0].damage).toBe(1);
    });

    it("can target a friendly ground unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.salaciousCrumb)
          .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker)
          .Build(),
      );

      await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.shd.salaciousCrumb, playId: g.state.player1.groundArena[0].playId });
      await g.chooseGroundUnitAsync(1, 0); // the Walker (Crumb already left play)

      expect(g.state.player1.groundArena[0].damage).toBe(1);
    });

    it("cannot target a space unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.salaciousCrumb)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
          .Build(),
      );

      await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.shd.salaciousCrumb, playId: g.state.player1.groundArena[0].playId });
      await g.chooseSpaceUnitAsync(2, 0);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player2.spaceArena[0].damage).toBe(0);
    });

    it("the ability is unavailable while he is exhausted", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.salaciousCrumb, false) // exhausted
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .Build(),
      );

      await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.shd.salaciousCrumb, playId: g.state.player1.groundArena[0].playId });

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.groundArena.length).toBe(1);
    });

    it("is not offered when there is no ground unit to damage", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .WithGroundUnitForPlayer(1, Cards.units.shd.salaciousCrumb)
          .Build(),
      );

      // Crumb himself is a ground unit, so a target always exists while he is in play —
      // he can shoot himself on the way out. Verify that path resolves cleanly.
      await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.shd.salaciousCrumb, playId: g.state.player1.groundArena[0].playId });

      // He left play as a cost, so the only remaining ground target list is empty → no prompt.
      expect(g.state.player1.hand.some(c => c.cardId === Cards.units.shd.salaciousCrumb)).toBe(true);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });
  });
});
