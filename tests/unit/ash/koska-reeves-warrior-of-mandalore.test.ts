import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_079 Koska Reeves — Warrior of Mandalore. Cost 4, 4/4 Ground Mandalorian, unique.
//   "While you control a token unit, this unit gains Sentinel.
//    When Played: If a friendly unit was defeated this phase, create a Mandalorian token."
//
// Neither clause is Mandalorian-specific: ANY token unit switches Sentinel on, and ANY friendly
// unit dying this phase satisfies the When Played.

const KOSKA = Cards.units.ash.koskaReeves;
const MANDO_TOKEN = Cards.units.token.mandalorian;
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14);
}

const tokenCount = (g: GameTestAdapter, p: 1 | 2) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.filter(u => u.cardId === MANDO_TOKEN).length;

describe("ASH_079 Koska Reeves — Warrior of Mandalore", () => {
  describe("When Played: create a Mandalorian token if a friendly unit was defeated this phase", () => {
    it("creates one after a friendly unit died this phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithActivePlayer(1)
          .WithGroundUnitForPlayer(1, MARINE)          // will die attacking
          .WithGroundUnitForPlayer(2, Cards.units.sor.wampa) // 4/5, kills the 3/3
          .WithCardInHandForPlayer(1, KOSKA)
          .Build(),
      );
      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.dispatchAsync(2, "pass-action", {});
      expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false);

      await g.playCardFromHandAsync(1, 0);

      expect(tokenCount(g, 1)).toBe(1);
    });

    it("creates nothing when no friendly unit was defeated this phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base().WithActivePlayer(1).WithCardInHandForPlayer(1, KOSKA).Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(tokenCount(g, 1)).toBe(0);
      expect(g.state.player1.groundArena.some(u => u.cardId === KOSKA)).toBe(true);
    });

    it("an ENEMY unit dying does not satisfy it — the clause says FRIENDLY", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithActivePlayer(1)
          .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)  // 4/5 kills the 3/3 and lives
          .WithGroundUnitForPlayer(2, MARINE)
          .WithCardInHandForPlayer(1, KOSKA)
          .Build(),
      );
      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.dispatchAsync(2, "pass-action", {});
      expect(g.state.player2.groundArena.some(u => u.cardId === MARINE)).toBe(false);

      await g.playCardFromHandAsync(1, 0);

      expect(tokenCount(g, 1)).toBe(0);
    });
  });

  describe("Sentinel while you control a token unit", () => {
    /** Player 2 attacks; the targets they are offered reveal whether Koska has Sentinel. */
    async function targetsOfferedToOpponent(g: GameTestAdapter) {
      await g.attackWithGroundUnitAsync(2, 0);
      const res = g.lastDispatchResponse?.resolutionNeeded;
      return {
        playIds: res?.type === "Target" ? (res.fromPlayIds ?? []) : [],
        zones: (res as { fromZones?: string[] })?.fromZones ?? [],
      };
    }

    it("forces enemy attacks onto her while a friendly token unit is in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithActivePlayer(2)
          .WithGroundUnitForPlayer(1, KOSKA)
          .WithGroundUnitForPlayer(1, MANDO_TOKEN)
          .WithGroundUnitForPlayer(2, SECURITY)
          .Build(),
      );

      const koska = g.state.player1.groundArena.find(u => u.cardId === KOSKA)!;
      const offered = await targetsOfferedToOpponent(g);
      expect(offered.playIds).toEqual([koska.playId]);
      expect(offered.zones).not.toContain("Base");
    });

    it("has no Sentinel without a token unit — the token is the whole condition", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithActivePlayer(2)
          .WithGroundUnitForPlayer(1, KOSKA)
          .WithGroundUnitForPlayer(1, MARINE)   // a normal unit, not a token
          .WithGroundUnitForPlayer(2, SECURITY)
          .Build(),
      );

      const offered = await targetsOfferedToOpponent(g);
      expect(offered.zones).toContain("Base");
      expect(offered.playIds.length).toBe(2);
    });
  });
});
