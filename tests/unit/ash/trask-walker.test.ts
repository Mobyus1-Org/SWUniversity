import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_133 Trask Walker. Cost 8, 5/9 Ground Vehicle/Walker.
//   "When Played/On Attack: Choose a unit in your discard pile that costs 7 or less. Either put
//    that card on the bottom of your deck and heal 3 damage from your base or return it to your
//    hand."
//
// It fires on BOTH triggers, and the two modes are exclusive. "Your discard pile" and "a unit"
// are the two filters, alongside the cost cap.

const TRASK = Cards.units.ash.traskWalker;
const CHEAP_UNIT = Cards.units.sor.battlefieldMarine;   // cost 2 Unit
const BIG_UNIT = "ASH_113";                             // cost 7 Unit — at the cap
const TOO_BIG = "ASH_038";                              // Purrgil Ultra, cost 8 — over the cap
const AN_EVENT = Cards.events.sor.openFire;             // not a unit
const MARINE = Cards.units.sor.battlefieldMarine;

/** Base starts on 5 damage so the heal-3 mode is visible as a drop to 2. */
function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
};
const discardPlayId = (g: GameTestAdapter, cardId: string) =>
  g.state.player1.discard.find(c => c.cardId === cardId)!.playId;

describe("ASH_133 Trask Walker", () => {
  describe("When Played", () => {
    it("bottoms the chosen card and heals 3 from your base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base().WithCardInHandForPlayer(1, TRASK).WithCardInDiscardForPlayer(1, CHEAP_UNIT).Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardPlayId(g, CHEAP_UNIT)] });
      await g.chooseOptionAsync(1, "bottom");

      expect(g.state.player1.discard.some(c => c.cardId === CHEAP_UNIT)).toBe(false);
      expect(g.state.player1.deck[0].cardId).toBe(CHEAP_UNIT); // bottom of deck
      expect(g.state.player1.base.damage).toBe(2);
    });

    it("returns the chosen card to hand instead, healing nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base().WithCardInHandForPlayer(1, TRASK).WithCardInDiscardForPlayer(1, CHEAP_UNIT).Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardPlayId(g, CHEAP_UNIT)] });
      await g.chooseOptionAsync(1, "hand");

      expect(g.state.player1.hand.some(c => c.cardId === CHEAP_UNIT)).toBe(true);
      expect(g.state.player1.discard.some(c => c.cardId === CHEAP_UNIT)).toBe(false);
      expect(g.state.player1.base.damage).toBe(5);
    });

    it("offers a unit costing exactly 7 but not one costing 8", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithCardInHandForPlayer(1, TRASK)
          .WithCardInDiscardForPlayer(1, BIG_UNIT)
          .WithCardInDiscardForPlayer(1, TOO_BIG)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(offered(g)).toContain(discardPlayId(g, BIG_UNIT));
      expect(offered(g)).not.toContain(discardPlayId(g, TOO_BIG));
    });

    it("offers a unit with NO cost entry — those cost 0, not 99", async () => {
      // Porg has no cost in the generated data because it costs 0. A `?? 99` fallback would make
      // every such unit silently ineligible.
      const g = new GameTestAdapter();
      g.loadNewState(
        base().WithCardInHandForPlayer(1, TRASK).WithCardInDiscardForPlayer(1, "LOF_254").Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(offered(g)).toContain(discardPlayId(g, "LOF_254"));
    });

    it("does not offer a non-unit card", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithCardInHandForPlayer(1, TRASK)
          .WithCardInDiscardForPlayer(1, CHEAP_UNIT)
          .WithCardInDiscardForPlayer(1, AN_EVENT)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(offered(g)).not.toContain(discardPlayId(g, AN_EVENT));
    });

    it("does not reach the OPPONENT's discard pile", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base().WithCardInHandForPlayer(1, TRASK).WithCardInDiscardForPlayer(2, CHEAP_UNIT).Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });

    it("prompts nothing with an empty discard", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInHandForPlayer(1, TRASK).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(g.state.player1.groundArena.some(u => u.cardId === TRASK)).toBe(true);
    });
  });

  describe("On Attack", () => {
    it("fires again when it attacks", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, TRASK)
          .WithCardInDiscardForPlayer(1, CHEAP_UNIT)
          .Build(),
      );

      // The attack target is locked in first; On Attack only fires once it is.
      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardPlayId(g, CHEAP_UNIT)] });
      await g.chooseOptionAsync(1, "hand");

      expect(g.state.player1.hand.some(c => c.cardId === CHEAP_UNIT)).toBe(true);
      expect(g.state.player2.base.damage).toBe(5); // the attack still resolves
    });
  });
});
