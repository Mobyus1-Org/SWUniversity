import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_139 Krrsantan - Muscle for Hire (3/7 Ground, cost 5) —
//   "When Played: If an enemy unit has a Bounty, you may ready this unit.
//    On Attack: Choose a ground unit. You may deal 1 damage to it for each damage on this unit."
describe("SHD_139 Krrsantan - Muscle for Hire", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  describe("When Played: ready if an enemy has a Bounty", () => {
    it("readies him when an enemy unit has a Bounty and the player accepts", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer) // printed Bounty
          .WithCardInHandForPlayer(1, Cards.units.shd.krrsantan)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);

      const k = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.krrsantan)!;
      expect(k.ready).toBe(true);
    });

    it("declining leaves him exhausted", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer)
          .WithCardInHandForPlayer(1, Cards.units.shd.krrsantan)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1);

      const k = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.krrsantan)!;
      expect(k.ready).toBe(false);
    });

    it("control: no enemy Bounty means no prompt and no ready", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // no Bounty
          .WithCardInHandForPlayer(1, Cards.units.shd.krrsantan)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      const k = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.krrsantan)!;
      expect(k.ready).toBe(false);
    });
  });

  describe("On Attack: 1 damage per damage on him", () => {
    it("deals damage equal to his own damage to a chosen ground unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.shd.krrsantan, true, 4) // 4 damage on him
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9 defender
          .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)           // 4/5 bystander, survives the ping
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(2, 1); // ping the bystander for 4

      expect(g.state.player2.groundArena[1].damage).toBe(4);
    });

    it("declining deals nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.shd.krrsantan, true, 4)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.chooseNoAsync(1);

      expect(g.state.player2.groundArena[1].damage).toBe(0);
      expect(g.state.player2.groundArena[0].damage).toBe(3); // combat only
    });

    it("control: an undamaged Krrsantan gets no prompt (0 damage to deal)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.shd.krrsantan) // undamaged
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(g.state.player2.groundArena[1].damage).toBe(0);
    });

    it("the amount is fixed when the prompt is raised, not recomputed after combat", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.shd.krrsantan, true, 2) // 2 damage
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6 power — will add more
          .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(2, 1);

      // 2 at prompt time — NOT 8 (2 + the 6 combat damage he takes afterwards).
      expect(g.state.player2.groundArena[1].damage).toBe(2);
    });
  });
});
