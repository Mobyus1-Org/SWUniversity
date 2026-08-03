import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_087 Crosshair - Following Orders (2/6 Ground, cost 4) —
//   "Action [2 resources]: This unit gets +1/+0 for this phase.
//    Action [Exhaust]: This unit deals damage equal to his power to an enemy ground unit."
describe("SHD_087 Crosshair - Following Orders", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const useAction = (g: GameTestAdapter, which: 1 | 2) =>
    g.dispatchAsync(1, "use-ability", {
      cardId: `SHD_087-${which}`,
      playId: g.state.player1.groundArena[0].playId,
    });

  describe("Action 1 [2 resources]: +1/+0 for this phase", () => {
    it("costs 2 resources and does not exhaust him", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.crosshair)
          .Build(),
      );

      await useAction(g, 1);

      const crosshair = Unit.FromInterface(g.state.player1.groundArena[0]);
      expect(crosshair.CurrentPower()).toBe(3); // 2 + 1
      expect(crosshair.TotalHP()).toBe(6);      // HP untouched
      expect(g.state.player1.groundArena[0].ready).toBe(true);
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(2);
    });

    it("stacks when used repeatedly", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.crosshair)
          .Build(),
      );

      await useAction(g, 1);
      await g.dispatchAsync(2, "pass-action", {});
      await useAction(g, 1);

      expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(4); // 2 + 1 + 1
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(4);
    });

    it("is unaffordable with fewer than 2 resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
          .WithGroundUnitForPlayer(1, Cards.units.shd.crosshair)
          .Build(),
      );

      await useAction(g, 1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(2);
    });
  });

  describe("Action 2 [Exhaust]: deal power to an enemy ground unit", () => {
    it("deals his current power and exhausts him", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.crosshair)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9
          .Build(),
      );

      await useAction(g, 2);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(2); // his printed power
      expect(g.state.player1.groundArena[0].ready).toBe(false);
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(0); // free
    });

    it("uses his BUFFED power when Action 1 was used first", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.crosshair)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .Build(),
      );

      await useAction(g, 1);
      await g.dispatchAsync(2, "pass-action", {});
      await useAction(g, 2);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(3); // 2 + 1
    });

    it("cannot target a FRIENDLY ground unit ('an enemy ground unit')", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.crosshair)
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .Build(),
      );

      await useAction(g, 2);
      await g.chooseGroundUnitAsync(1, 1); // my own Marine

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.groundArena[1].damage).toBe(0);
    });

    it("is unavailable while he is exhausted", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.crosshair, false)
          .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
          .Build(),
      );

      await useAction(g, 2);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player2.groundArena[0].damage).toBe(0);
    });

    it("is unavailable with no enemy ground unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithGroundUnitForPlayer(1, Cards.units.shd.crosshair)
          .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
          .Build(),
      );

      await useAction(g, 2);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });
  });
});
