import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_122 Squad Support (Upgrade, Command, cost 3) —
//   "Attach to a non-leader unit."
//   "Attached unit gains: 'This unit gets +1/+1 for each Trooper unit you control.'"
//
// The count is live and includes the host itself when the host is a Trooper.
describe("TWI_122 Squad Support", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithActivePlayer(1);
  }

  /** Host at ground index 0, wearing Squad Support. */
  function hostWith(extra: (b: GameStateBuilder) => GameStateBuilder = b => b) {
    const s = extra(
      base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine), // 3/3 Trooper
    )
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.twi.squadSupport, 1),
      ])
      .Build();
    const g = new GameTestAdapter();
    g.loadNewState(s);
    return { g, host: Unit.FromInterface(g.state.player1.groundArena[0]) };
  }

  describe("'Attach to a non-leader unit.'", () => {
    it("offers non-leader units and withholds a deployed leader unit", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .MyLeader(Cards.leaders.sor.leiaOrgana, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.leiaOrgana) // the leader unit
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.twi.squadSupport)
        .Build();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);

      const targets = TargetIds(g);
      expect(targets).not.toContain(s.player1.groundArena[0].playId); // Leia
      expect(targets).toContain(s.player1.groundArena[1].playId);
    });
  });

  describe("'+1/+1 for each Trooper unit you control'", () => {
    it("counts the host itself when the host is a Trooper", () => {
      const { host } = hostWith(); // lone Battlefield Marine, a Trooper
      expect(host.CurrentPower()).toBe(4); // 3 + 1
      expect(host.TotalHP()).toBe(4);
    });

    it("scales with each additional friendly Trooper", () => {
      const { host } = hostWith(b => b
        .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper)   // Trooper
        .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire)); // Trooper
      expect(host.CurrentPower()).toBe(6); // 3 + 3 Troopers
      expect(host.TotalHP()).toBe(6);
    });

    it("ignores friendly NON-Trooper units", () => {
      const { host } = hostWith(b => b.WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker)); // Jedi
      expect(host.CurrentPower()).toBe(4); // still just the host
    });

    it("ignores ENEMY Troopers — 'you control'", () => {
      const { host } = hostWith(b => b
        .WithGroundUnitForPlayer(2, Cards.units.token.cloneTrooper)
        .WithGroundUnitForPlayer(2, Cards.units.lof.sithLegionnaire));
      expect(host.CurrentPower()).toBe(4);
    });

    it("counts Troopers in the SPACE arena too — the text says no arena", () => {
      // Sanity: a non-Trooper host so the count is unambiguous.
      const s = base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker) // 6/7, not a Trooper
        .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.twi.squadSupport, 1),
        ])
        .Build();
      const g = new GameTestAdapter();
      g.loadNewState(s);

      const luke = Unit.FromInterface(g.state.player1.groundArena[0]);
      expect(luke.CurrentPower()).toBe(7); // 6 + 1 Trooper
      expect(luke.TotalHP()).toBe(8);
    });

    it("is live: the bonus drops when a Trooper leaves play", async () => {
      const s = base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.twi.squadSupport, 1),
        ])
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build();
      const g = new GameTestAdapter();
      g.loadNewState(s);

      expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(5); // 3 + 2

      await g.playCardFromHandAsync(1, 0); // Vanquish my own Clone Trooper
      await g.chooseGroundUnitAsync(1, 1);

      expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(4); // 3 + 1
    });

    it("control: the same board without the upgrade gets nothing", () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper)
          .Build(),
      );
      expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
    });
  });
});
