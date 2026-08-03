import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_091 Jabba's Rancor - Pateesa (9/9 Ground, cost 8) —
//   "If you control Jabba the Hutt (as a leader or unit), this unit costs 1 resource less to play.
//    When Played/On Attack: Deal 3 damage to another friendly ground unit and 3 damage to an
//    enemy ground unit."
describe("SHD_091 Jabba's Rancor - Pateesa", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  describe("cost reduction", () => {
    it("costs its printed 8 without Jabba the Hutt", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithCardInHandForPlayer(1, Cards.units.shd.jabbasRancor)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(8);
    });

    it("costs 1 less while Jabba the Hutt is your LEADER (undeployed)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .MyLeader(Cards.leaders.shd.jabbaTheHutt)
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithCardInHandForPlayer(1, Cards.units.shd.jabbasRancor)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(7);
    });

    it("costs 1 less while you control Jabba the Hutt as a UNIT", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.sor.jabbaTheHutt)
          .WithCardInHandForPlayer(1, Cards.units.shd.jabbasRancor)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(7);
    });

    it("an OPPONENT's Jabba the Hutt does not discount it", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(2, Cards.units.sor.jabbaTheHutt)
          .WithCardInHandForPlayer(1, Cards.units.shd.jabbasRancor)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(8);
    });
  });

  describe("When Played / On Attack damage", () => {
    it("When Played: 3 to another friendly ground unit and 3 to an enemy ground unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards) // 4/6 friendly
          .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // 4/6 enemy
          .WithCardInHandForPlayer(1, Cards.units.shd.jabbasRancor)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0); // friendly Honor Guards
      await g.chooseGroundUnitAsync(2, 0); // enemy Honor Guards

      expect(g.state.player1.groundArena[0].damage).toBe(3);
      expect(g.state.player2.groundArena[0].damage).toBe(3);
      // "ANOTHER friendly" — the Rancor never damages itself.
      expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.jabbasRancor)?.damage).toBe(0);
    });

    it("cannot choose ITSELF as the friendly target ('another friendly ground unit')", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards)
          .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
          .WithCardInHandForPlayer(1, Cards.units.shd.jabbasRancor)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      const rancorIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.shd.jabbasRancor);
      await g.chooseGroundUnitAsync(1, rancorIdx);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });

    it("fizzles when there is no OTHER friendly ground unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
          .WithCardInHandForPlayer(1, Cards.units.shd.jabbasRancor)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player2.groundArena[0].damage).toBe(0);
    });

    it("On Attack: fires the same damage before combat resolves", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.shd.jabbasRancor)
          .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards) // 4/6 friendly
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9 enemy defender
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0); // attack target
      await g.chooseGroundUnitAsync(1, 1); // friendly Honor Guards takes 3
      await g.chooseGroundUnitAsync(2, 0); // enemy Walker takes 3

      expect(g.state.player1.groundArena[1].damage).toBe(3);
      // Walker: 3 from the ability + 9 combat power = defeated.
      expect(g.state.player2.groundArena.length).toBe(0);
    });
  });
});
