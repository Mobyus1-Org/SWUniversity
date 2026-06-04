import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_152 For a Cause I Believe In — Cost 3, Aggression+Heroism Event
// Reveal the top 4 cards of your deck. For each [Heroism] card revealed this way,
// deal 1 damage to an enemy base. You may discard any of the revealed cards and
// put the rest back on top of your deck in any order.

describe("SOR_152 For a Cause I Believe In", () => {
  describe("damage from Heroism cards", () => {
    it("deals 1 damage to enemy base per Heroism card revealed", async () => {
      const g = new GameTestAdapter();
      // Deck: 2 Heroism (battlefieldMarine) + 2 non-Heroism (systemPatrolCraft)
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren) // Aggression + Heroism
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.forACauseIBelieveIn)
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)  // tempId "0"
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)  // tempId "1"
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "2"
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "3" (top)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] }); // discard nothing

      expect(g.state.player2.base.damage).toBe(2);
    });

    it("deals 0 damage when no Heroism cards are revealed", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.forACauseIBelieveIn)
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)  // tempId "0"
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)  // tempId "1"
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)  // tempId "2"
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)  // tempId "3"
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(g.state.player2.base.damage).toBe(0);
    });

    it("deals 4 damage when all 4 revealed cards are Heroism", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.forACauseIBelieveIn)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(g.state.player2.base.damage).toBe(4);
    });
  });

  describe("discard and return to deck", () => {
    it("chosen cards go to player discard pile, unchosen return to top of deck", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.forACauseIBelieveIn)
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)  // tempId "0" → discard
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)  // tempId "1" → discard
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "2" → keep
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "3" → keep
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["0", "1"] });

      const deck = g.state.player1.deck;
      const discard = g.state.player1.discard;
      expect(deck.length).toBe(2);
      expect(deck.every(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
      // 2 systemPatrolCrafts + the event card itself
      expect(discard.length).toBe(3);
      expect(discard.filter(c => c.cardId === Cards.units.sor.systemPatrolCraft).length).toBe(2);
    });

    it("returns all 4 to top of deck when none are discarded", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.forACauseIBelieveIn)
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithCardInDeckForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(g.state.player1.deck.length).toBe(4);
      expect(g.state.player1.discard.length).toBe(1); // only the event card itself
    });

    it("discards all 4 to discard pile when all are chosen", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.forACauseIBelieveIn)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["0", "1", "2", "3"] });

      expect(g.state.player1.deck.length).toBe(0);
      expect(g.state.player1.discard.length).toBe(5); // 4 discarded + event card itself
    });
  });

  describe("edge cases", () => {
    it("works with fewer than 4 cards in deck", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.forACauseIBelieveIn)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "0"
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "1"
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["0", "1"] });

      expect(g.state.player2.base.damage).toBe(2);
      expect(g.state.player1.deck.length).toBe(0);
      expect(g.state.player1.discard.length).toBe(3); // 2 discarded + event card itself
    });

    it("resolves with empty deck — no interaction required", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.forACauseIBelieveIn)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      // No pending — empty deck resolves immediately with 0 damage
      expect(g.state.player2.base.damage).toBe(0);
    });
  });
});
