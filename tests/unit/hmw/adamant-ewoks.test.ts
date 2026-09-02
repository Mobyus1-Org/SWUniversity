import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_177 Adamant Ewoks (3/2 Ground, cost 2, Aggression, Ewok) —
//   "When Played: If you control another Ewok unit or an Endor base, you may deal 1 damage to a
//    base and 1 damage to an enemy unit."
//
// Three things stacked in one line:
//   1. an OR condition (another Ewok unit / an Endor base) — both halves need their own test;
//   2. "you may", so it is one combined yes/no, not two separate offers;
//   3. TWO targets in sequence — a base (either one, unqualified) then an ENEMY unit.
//
// The chain matters: declining must skip BOTH halves, which is why the enemy-unit step hangs off
// the base step's continuation rather than off the option's, where a "No" would still run it.

const EWOKS = "HMW_177";
const OTHER_EWOK = "ASH_166";                     // Ewok Warrior
const ENDOR_BASE = "JTL_020";                     // Shield Generator Complex
const PLAIN_BASE = Cards.bases.common.green30HP;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function setup(myBase: string = PLAIN_BASE) {
  return new GameStateBuilder()
    .MyBase(myBase, 5)
    .MyLeader(Cards.leaders.sor.sabineWren) // Aggression
    .TheirBase(Cards.bases.common.green30HP, 5)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, EWOKS)
    .WithActivePlayer(1);
}

describe("HMW_177 Adamant Ewoks", () => {
  describe("the condition", () => {
    it("offers the ability when you control another EWOK unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, OTHER_EWOK).WithGroundUnitForPlayer(2, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).not.toBeNull();
    });

    it("offers the ability when you control an ENDOR base, with no other Ewok", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(ENDOR_BASE).WithGroundUnitForPlayer(2, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).not.toBeNull();
    });

    it("does not offer it with neither", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });

    it("does NOT count itself — the Ewoks are an Ewok unit, and the text says 'another'", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });

    it("an ENEMY Ewok does not count — 'you control'", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, OTHER_EWOK).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });

    it("the OPPONENT's Endor base does not count", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        new GameStateBuilder()
          .MyBase(PLAIN_BASE, 5)
          .MyLeader(Cards.leaders.sor.sabineWren)
          .TheirBase(ENDOR_BASE, 5)
          .TheirLeader(Cards.leaders.sor.sabineWren)
          .FillResourcesForPlayer(1, MARINE, 14)
          .WithCardInHandForPlayer(1, EWOKS)
          .WithGroundUnitForPlayer(2, MARINE)
          .WithActivePlayer(1)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });
  });

  describe("the effect", () => {
    it("deals 1 to the chosen base and 1 to the chosen enemy unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(ENDOR_BASE).WithGroundUnitForPlayer(2, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.base.damage).toBe(6);              // 5 + 1
      expect(g.state.player2.groundArena[0].damage).toBe(1);
    });

    it("can aim the base half at your OWN base — 'a base' is unqualified", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(ENDOR_BASE).WithGroundUnitForPlayer(2, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player1.base.damage).toBe(6);
      expect(g.state.player2.groundArena[0].damage).toBe(1);
    });

    it("declining skips BOTH halves", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(ENDOR_BASE).WithGroundUnitForPlayer(2, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1);

      expect(g.state.player1.base.damage).toBe(5);
      expect(g.state.player2.base.damage).toBe(5);
      expect(g.state.player2.groundArena[0].damage).toBe(0);
      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });

    it("cannot aim the unit half at a FRIENDLY unit — it says 'an enemy unit'", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(ENDOR_BASE)
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

      const friendly = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
      const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
      expect(pending?.type).toBe("Target");
      const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
      expect(offered).not.toContain(friendly.playId);
      expect(offered).toHaveLength(1); // only the enemy Marine
    });

    it("still does the base half when the opponent has no units", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(ENDOR_BASE).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

      expect(g.state.player2.base.damage).toBe(6);
      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });
  });
});
