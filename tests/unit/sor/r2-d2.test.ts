import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// SOR_236 — R2-D2 (cost 1, 4/1, Space, Heroism)
// When Played/On Attack: Scry 1 — look at top card, optionally put it on the bottom.
// Using "ggw" (green base, Leia Organa — Command+Heroism) to cover Heroism aspect.

describe("SOR_236 — R2-D2", () => {
  describe("When Played", () => {
    it("shows the top card and puts it on the bottom when chosen", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 1 }, their: {} })
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // deeper
        .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)   // top (tempId "0")
        .WithCardInHandForPlayer(1, Cards.units.sor.r2d2)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      // Scry prompt — put top card on bottom
      await g.chooseDeckSearchAsync(1, ["0"]);

      const deck = g.state.player1.deck;
      expect(deck[deck.length - 1].cardId).toBe(Cards.units.sor.battlefieldMarine); // stays on top
      expect(deck[0].cardId).toBe(Cards.units.sor.echoBaseDefender);                // moved to bottom
    });

    it("leaves the top card on top when nothing is chosen", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 1 }, their: {} })
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)   // top
        .WithCardInHandForPlayer(1, Cards.units.sor.r2d2)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      // Scry prompt — leave on top (submit nothing)
      await g.chooseDeckSearchAsync(1, []);

      const deck = g.state.player1.deck;
      expect(deck[deck.length - 1].cardId).toBe(Cards.units.sor.echoBaseDefender); // still on top
    });

    it("fizzles when deck is empty", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 1 }, their: {} })
        // No cards in deck — Kelleran-style: fizzle with empty deck
        .WithCardInHandForPlayer(1, Cards.units.sor.r2d2)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      // No scry pending — R2-D2 just enters the ground arena
      expect(g.state.player1.groundArena.length).toBe(1);
    });
  });

  describe("On Attack", () => {
    it("triggers scry when R2-D2 attacks", async () => {
      const g = new GameTestAdapter();
      const gsb = new GameStateBuilder();
      const state = CommonSetup(gsb, "ggw", "rrk", { my: {}, their: {} })
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)  // deeper
        .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)   // top
        .WithGroundUnitForPlayer(1, Cards.units.sor.r2d2)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      // Scry fires before combat resolves
      await g.chooseDeckSearchAsync(1, ["0"]); // put top card on bottom

      const deck = g.state.player1.deck;
      expect(deck[0].cardId).toBe(Cards.units.sor.echoBaseDefender); // moved to bottom
    });
  });
});
