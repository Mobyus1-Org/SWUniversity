import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_181 Jabba the Hutt — Cost 4, 8/2, Ground, Cunning+Villainy
// Each TRICK event you play costs 1 resource less.
// When Played: Search top 8 for a TRICK event, reveal it, draw it.

describe("SOR_181 Jabba the Hutt", () => {
  describe("When Played: search top 8 for a TRICK event and draw it", () => {
    it("draws a TRICK event from the top 8 of the deck", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.bobaFett) // Cunning+Villainy
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithCardInHandForPlayer(1, Cards.units.sor.jabbaTheHutt)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "0" — non-TRICK
        .WithCardInDeckForPlayer(1, Cards.events.sor.waylay)            // tempId "1" — TRICK event
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseDeckSearchAsync(1, ["1"]);

      expect(g.state.player1.hand.some(c => c.cardId === Cards.events.sor.waylay)).toBe(true);
      expect(g.state.player1.deck.length).toBe(1);
    });

    it("fizzles when no TRICK event is in top 8", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.bobaFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithCardInHandForPlayer(1, Cards.units.sor.jabbaTheHutt)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    });
  });

  describe("Static: TRICK events cost 1 less", () => {
    it("a 2-cost TRICK event is playable with 1 resource while Jabba is in play", async () => {
      const g = new GameTestAdapter();
      // asteroidSanctuary (SOR_218) costs 2, Cunning aspect (no penalty with bobaFett)
      // Jabba discount → costs 1 → playable with 1 resource
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.bobaFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
        .WithGroundUnitForPlayer(1, Cards.units.sor.jabbaTheHutt)
        .WithCardInHandForPlayer(1, Cards.events.sor.asteroidSanctuary)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
    });

    it("a 2-cost TRICK event is NOT playable with 1 resource without Jabba", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.bobaFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
        .WithCardInHandForPlayer(1, Cards.events.sor.asteroidSanctuary)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });
  });
});
