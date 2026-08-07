import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

const EXPERIENCE = Cards.upgrades.token.experience;
const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === EXPERIENCE).length;
const spent = (g: GameTestAdapter) => g.state.player1.resources.filter(r => !r.ready).length;

// TS26_60 Take Charge (Event, cost 3) —
//   "This event costs 1 resource less to play for each friendly leader unit.
//    Give an Experience token to each of up to 3 units."
describe("TS26_60 Take Charge", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP) // Command — no aspect penalty
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.ts26.takeCharge)
      .WithActivePlayer(1);
  }

  describe("cost discount", () => {
    it("costs its printed 3 with no friendly leader unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(spent(g)).toBe(3);
    });

    it("costs 1 less per friendly leader unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .MyLeader(Cards.leaders.sor.leiaOrgana, true, true)
          .WithGroundUnitForPlayer(1, Cards.leaders.sor.leiaOrgana)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(spent(g)).toBe(2); // 3 - 1
    });

    it("an ENEMY leader unit does not discount it", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
          .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(spent(g)).toBe(3);
    });

    it("a friendly NON-leader unit does not discount it", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(spent(g)).toBe(3);
    });
  });

  describe("give an Experience token to each of up to 3 units", () => {
    it("gives one token to each of three chosen units", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
          .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      const ids = [
        g.state.player1.groundArena[0].playId,
        g.state.player1.groundArena[1].playId,
        g.state.player2.groundArena[0].playId,
      ];
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

      expect(xp(g.state.player1.groundArena[0])).toBe(1);
      expect(xp(g.state.player1.groundArena[1])).toBe(1);
      expect(xp(g.state.player2.groundArena[0])).toBe(1); // "units", not "friendly units"
    });

    it("accepts fewer than 3 — it is 'up to'", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
          .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

      expect(xp(g.state.player1.groundArena[0])).toBe(1);
      expect(xp(g.state.player1.groundArena[1])).toBe(0);
    });

    it("caps at 3 even when more units are selected", async () => {
      const g = new GameTestAdapter();
      let b = base();
      for (let i = 0; i < 4; i++) b = b.WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine);
      g.loadNewState(b.Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", {
        targetPlayIds: g.state.player1.groundArena.map(u => u.playId),
      });

      const total = g.state.player1.groundArena.reduce((s, u) => s + xp(u), 0);
      expect(total).toBe(3);
    });

    it("fizzles cleanly with no units in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(spent(g)).toBe(3);
    });
  });
});
