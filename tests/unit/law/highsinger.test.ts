import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_059 Highsinger — "When Played: Give an Experience token to another friendly Command
// unit.  When Defeated: Give an Experience token to a friendly Aggression unit."
//
// The two clauses use DIFFERENT aspects, and only the When Played one says "another".
// Highsinger himself is Command+Aggression, so he is an illegal When Played target (excluded
// by "another") but would be a legal Aggression target — except he has just been defeated.

const xpOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === Cards.upgrades.token.experience).length;

// Battlefield Marine is Command/Heroism; Consular Security Force is Vigilance-only here and
// serves as the "wrong aspect" control.
const COMMAND_UNIT = Cards.units.sor.battlefieldMarine;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, COMMAND_UNIT, 16);
}

describe("LAW_059 Highsinger", () => {
  describe("When Played — Experience to another friendly Command unit", () => {
    it("gives an Experience token to the chosen friendly Command unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .WithCardInHandForPlayer(1, Cards.units.law.highsinger)
          .WithGroundUnitForPlayer(1, COMMAND_UNIT)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);

      expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
    });

    it("cannot target Highsinger himself ('another')", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .WithCardInHandForPlayer(1, Cards.units.law.highsinger)
          .WithGroundUnitForPlayer(1, COMMAND_UNIT)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

      const highsingerIdx = g.state.player1.groundArena.findIndex(
        u => u.cardId === Cards.units.law.highsinger,
      );
      await g.chooseGroundUnitAsync(1, highsingerIdx);
      expect(g.lastDispatchResponse?.invalidAction).toBe(true);

      await g.chooseGroundUnitAsync(1, 0);
      expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
    });

    it("does nothing when no other friendly Command unit is in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .WithCardInHandForPlayer(1, Cards.units.law.highsinger)
          // Vigilance/Command? Consular Security Force is the non-Command control here.
          .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
    });

    it("does not offer an enemy Command unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .WithCardInHandForPlayer(1, Cards.units.law.highsinger)
          .WithGroundUnitForPlayer(2, COMMAND_UNIT)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      expect(xpOn(g.state.player2.groundArena[0])).toBe(0);
    });
  });

  describe("When Defeated — Experience to a friendly Aggression unit", () => {
    it("gives an Experience token to the chosen friendly Aggression unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          // Highsinger is 4/2 — Consular Security Force (3 power) kills him on the counter.
          .WithGroundUnitForPlayer(1, Cards.units.law.highsinger)
          .WithGroundUnitForPlayer(1, Cards.units.ash.praetorianElite) // Aggression/Villainy
          .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      // Resolve by playId, not index — Highsinger has already left the arena by now.
      const aggro = g.state.player1.groundArena.find(
        u => u.cardId === Cards.units.ash.praetorianElite,
      )!;
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [aggro.playId] });

      expect(g.state.player1.groundArena).toHaveLength(1);
      expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
    });

    it("does nothing when no friendly Aggression unit survives", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .WithGroundUnitForPlayer(1, Cards.units.law.highsinger)
          .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player1.groundArena).toHaveLength(0);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    });
  });
});
