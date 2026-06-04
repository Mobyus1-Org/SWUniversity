import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// SOR_031 — Inferno Four (cost 2, 3/2, Space, Vigilance+Villainy)
// When Played/When Defeated: Look at the top 2 cards of your deck.
//   Put any number of them on the bottom and the rest on top in any order.
// Using "bbk" (blue base, Iden Versio — Vigilance+Villainy) to avoid aspect penalties.

describe("SOR_031 — Inferno Four", () => {
  describe("When Played", () => {
    it("presents top 2 cards and puts the unchosen card on bottom", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      // deck (top = last): [battlefieldMarine(tempId "0"), echoBaseDefender(tempId "1")]
      const state = CommonSetup(gsb, "bbk", "ggw", { my: { resourceCount: 2 }, their: {} })
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "0"
        .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)   // tempId "1" (top)
        .WithCardInHandForPlayer(1, Cards.units.sor.infernoFour)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      // Send top ids in desired order: battlefieldMarine ("0") on top, echoBaseDefender goes to bottom
      await g.chooseDeckSearchAsync(1, ["0"]);

      const deck = g.state.player1.deck;
      expect(deck[deck.length - 1].cardId).toBe(Cards.units.sor.battlefieldMarine); // top
      expect(deck[0].cardId).toBe(Cards.units.sor.echoBaseDefender);                // bottom
    });

    it("puts top cards in player-chosen order (first sent = topmost)", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      // deck: [battlefieldMarine(tempId "0"), echoBaseDefender(tempId "1", originally on top)]
      const state = CommonSetup(gsb, "bbk", "ggw", { my: { resourceCount: 2 }, their: {} })
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithCardInHandForPlayer(1, Cards.units.sor.infernoFour)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      // Player picks battlefieldMarine ("0") first — it should end up on top even though it was deeper
      await g.chooseDeckSearchAsync(1, ["0", "1"]);

      const deck = g.state.player1.deck;
      expect(deck.length).toBe(2);
      expect(deck[deck.length - 1].cardId).toBe(Cards.units.sor.battlefieldMarine); // "0" is topmost
      expect(deck[deck.length - 2].cardId).toBe(Cards.units.sor.echoBaseDefender);  // "1" is beneath
    });

    it("returns all cards to top when none are sent to bottom", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      const state = CommonSetup(gsb, "bbk", "ggw", { my: { resourceCount: 2 }, their: {} })
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "0"
        .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)   // tempId "1" (top)
        .WithCardInHandForPlayer(1, Cards.units.sor.infernoFour)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      // Both on top; send in order "1" first (topmost), "0" second
      await g.chooseDeckSearchAsync(1, ["1", "0"]);

      const deck = g.state.player1.deck;
      expect(deck.length).toBe(2);
      expect(deck[deck.length - 1].cardId).toBe(Cards.units.sor.echoBaseDefender); // "1" topmost
      expect(deck[deck.length - 2].cardId).toBe(Cards.units.sor.battlefieldMarine);
    });

    it("can send all cards to bottom", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      const state = CommonSetup(gsb, "bbk", "ggw", { my: { resourceCount: 2 }, their: {} })
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithCardInHandForPlayer(1, Cards.units.sor.infernoFour)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      // Send nothing to top — both go to bottom
      await g.chooseDeckSearchAsync(1, []);

      const deck = g.state.player1.deck;
      expect(deck.length).toBe(2);
    });

    it("fizzles gracefully with an empty deck", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      const state = CommonSetup(gsb, "bbk", "ggw", { my: { resourceCount: 2 }, their: {} })
        .WithCardInHandForPlayer(1, Cards.units.sor.infernoFour)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      // Should not crash; Inferno Four enters the space arena
      expect(g.state.player1.spaceArena.length).toBe(1);
    });
  });

  describe("When Defeated", () => {
    it("triggers scry when Inferno Four is defeated in combat", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      // Inferno Four attacks enemy; enemy counter-kills it (Inferno Four = 3/2, needs defender power ≥ 2)
      const state = CommonSetup(gsb, "bbk", "ggw", { my: {}, their: {} })
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // tempId "0"
        .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)   // tempId "1" (top)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.infernoFour)         // 3/2
        .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)   // SOR_066, 2 power → kills Inferno Four
        .Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.spaceArena[0].playId;

      // Inferno Four attacks the enemy unit; counter-damage kills it
      await g.attackWithSpaceUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      // When Defeated fires — scry prompt: send battlefieldMarine ("0") as top, echoBaseDefender ("1") goes to bottom
      await g.chooseDeckSearchAsync(1, ["0"]);

      const deck = g.state.player1.deck;
      expect(deck.length).toBe(2);
      expect(deck[deck.length - 1].cardId).toBe(Cards.units.sor.battlefieldMarine); // stays on top
      expect(deck[0].cardId).toBe(Cards.units.sor.echoBaseDefender);                // moved to bottom
    });
  });
});
