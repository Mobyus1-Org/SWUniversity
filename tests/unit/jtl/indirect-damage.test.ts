import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// Indirect damage (CR 8.35). The rules this suite pins:
//   .1  choose a player; they assign X among any number of their units and/or their base
//   .2  unpreventable — ignores Shield tokens, and does NOT defeat them
//   .3  a unit cannot be assigned more than its remaining HP
//   .5  all of it is dealt simultaneously
// Plus the house rule that with no units to divide among, it all lands on the base with no prompt.
describe("Indirect damage — shared rules (CR 8.35)", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
      .WithActivePlayer(1);
  }

  const assign = (g: GameTestAdapter, player: 1 | 2, rows: { playId: string; damage: number }[]) =>
    g.dispatchAsync(player, "choose-target", { spreadDamageAssignments: rows });

  describe("CR 8.35.1 — target choice and free division", () => {
    it("divides between base and units as the victim chooses", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage) // 5 indirect
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10
        .Build();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await assign(g, 2, [
        { playId: "player2.base", damage: 2 },
        { playId: s.player2.groundArena[0].playId, damage: 3 },
      ]);

      expect(g.state.player2.base.damage).toBe(2);
      expect(g.state.player2.groundArena[0].damage).toBe(3);
    });

    it("can be aimed at yourself", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer)
        .Build();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Yourself" });
      await assign(g, 1, [{ playId: s.player1.groundArena[0].playId, damage: 5 }]);

      expect(g.state.player1.groundArena[0].damage).toBe(5);
      expect(g.state.player2.base.damage).toBe(0);
    });

    it("rejects an assignment that does not total the full amount", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      const res = await assign(g, 2, [{ playId: "player2.base", damage: 4 }]);

      expect(res.lastDispatchResponse?.invalidAction).toBe(true);
    });
  });

  describe("no units to divide among", () => {
    it("auto-assigns the whole amount to the base with no prompt", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

      expect(g.state.player2.base.damage).toBe(5);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });

    it("does the same when aimed at yourself with an empty board", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Yourself" });

      expect(g.state.player1.base.damage).toBe(5);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });
  });

  describe("CR 8.35.2 — unpreventable, and Shields survive", () => {
    it("damages through a Shield token without defeating it", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)])
        .Build();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await assign(g, 2, [{ playId: s.player2.groundArena[0].playId, damage: 5 }]);

      const victim = g.state.player2.groundArena[0];
      expect(victim.damage).toBe(5); // the Shield absorbed nothing
      expect(victim.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield)).toHaveLength(1);
    });
  });

  describe("CR 8.35.3 — per-unit cap is remaining HP", () => {
    it("rejects assigning a unit more than it has left", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
        .Build();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      const res = await assign(g, 2, [
        { playId: s.player2.groundArena[0].playId, damage: 4 },
        { playId: "player2.base", damage: 1 },
      ]);

      expect(res.lastDispatchResponse?.invalidAction).toBe(true);
    });

    it("accepts exactly its remaining HP, defeating it", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await assign(g, 2, [
        { playId: s.player2.groundArena[0].playId, damage: 3 },
        { playId: "player2.base", damage: 2 },
      ]);

      expect(g.state.player2.groundArena).toHaveLength(0);
      expect(g.state.player2.base.damage).toBe(2);
    });
  });

  describe("CR 8.35.5 — dealt simultaneously", () => {
    it("two units each taking lethal are both defeated by the one instance", async () => {
      const g = new GameTestAdapter();
      const s = base()
        .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1/1
        .WithGroundUnitForPlayer(2, Cards.units.token.cloneTrooper) // 2/2
        .Build();
      g.loadNewState(s);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
      await assign(g, 2, [
        { playId: s.player2.groundArena[0].playId, damage: 1 },
        { playId: s.player2.groundArena[1].playId, damage: 2 },
        { playId: "player2.base", damage: 2 },
      ]);

      expect(g.state.player2.groundArena).toHaveLength(0);
      expect(g.state.player2.base.damage).toBe(2);
    });
  });
});
