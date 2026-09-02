import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// HMW_234 Ritual Dragon (6/9 Ground, cost 8, Cunning, Creature) —
//   "Saboteur"
//   "While you control a Tatooine base, friendly units enter play ready (including this one)."
//
// The parenthetical is the whole difficulty. A unit's readiness is decided while it is being
// constructed, BEFORE it is pushed into the arena, so a Dragon checking "is a Dragon in play?"
// cannot see itself and would enter exhausted. The entering card has to be considered part of
// the board for its own check.
//
// "Friendly units" also means every entry path, not just hard-cast units: tokens are created
// through a different chokepoint (spawnToken) than played cards (addToArena), and a card wired
// to only one of them looks correct until someone makes a token.

const DRAGON = "HMW_234";
const TATOOINE_BASE = "JTL_030";                       // Mos Eisley
const PLAIN_BASE = Cards.bases.common.green30HP;       // no Tatooine trait
const MARINE = Cards.units.sor.battlefieldMarine;
const TOKEN_MAKER = "JTL_082";                         // Kijimi Patrollers — Create a TIE Fighter
const TIE_TOKEN = "JTL_T01";

function setup(base: string = TATOOINE_BASE) {
  return new GameStateBuilder()
    .MyBase(base)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20)
    .WithActivePlayer(1);
}

const dragon = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === DRAGON)!;

describe("HMW_234 Ritual Dragon", () => {
  it("has Saboteur", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, DRAGON).Build());
    const u = dragon(g);

    expect(HasSaboteur(u.cardId, u.playId, 1)).toBe(true);
  });

  describe("including this one", () => {
    it("enters play READY with a Tatooine base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, DRAGON).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(dragon(g).ready).toBe(true);
    });

    it("enters play exhausted without a Tatooine base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(PLAIN_BASE).WithCardInHandForPlayer(1, DRAGON).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(dragon(g).ready).toBe(false);
    });

    it("can actually attack the turn it lands", async () => {
      // The ready flag is only worth having if combat honours it.
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, DRAGON).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(2, "pass-action", {});
      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === DRAGON);
      await g.attackWithGroundUnitAsync(1, idx);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(6);
    });
  });

  describe("friendly units", () => {
    it("a later friendly unit enters play ready", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, DRAGON)
          .WithCardInHandForPlayer(1, MARINE)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(true);
    });

    it("a TOKEN enters play ready too — the other arena-entry path", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, DRAGON)
          .WithCardInHandForPlayer(1, TOKEN_MAKER)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      const tie = g.state.player1.spaceArena.find(u => u.cardId === TIE_TOKEN)!;
      expect(tie).toBeDefined();
      expect(tie.ready).toBe(true);
    });

    it("does NOT ready the opponent's units", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, DRAGON)
          .WithCardInHandForPlayer(2, MARINE)
          .Build(),
      );

      await g.dispatchAsync(1, "pass-action", {});
      await g.playCardFromHandAsync(2, 0);

      expect(g.state.player2.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(false);
    });

    it("control: no Dragon means normal exhausted entry, Tatooine base or not", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(false);
    });

    it("control: a Dragon on a non-Tatooine base grants nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(PLAIN_BASE)
          .WithGroundUnitForPlayer(1, DRAGON)
          .WithCardInHandForPlayer(1, MARINE)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(false);
    });

    it("stops granting once the Dragon loses its abilities", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, DRAGON)
          .WithCardInHandForPlayer(1, MARINE)
          .Build(),
      );

      g.state.currentEffects.push({
        cardId: "SOR_138", // Force Lightning
        duration: "Phase",
        affectedPlayer: 1,
        targetPlayId: dragon(g).playId,
      });

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(false);
    });
  });
});
