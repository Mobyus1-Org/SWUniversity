import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasFortify } from "@/server/engine/card-db/keyword-dictionaries.ts/fortify";

// HMW_037 Bacta Tank (Upgrade, cost 1, Vigilance/Command, Fortification) —
//   "Fortify"
//   "When Played: Heal up to 3 damage from a non-Vehicle unit."
//   "Action [defeat this upgrade]: Put a non-Vehicle unit from your discard pile on top of your
//    deck."
//
// The Action is the first one in the engine hosted by an UPGRADE rather than a unit or a leader.
// ActionAbilities walked leaders and units only, and use-ability resolved the actor with
// GetUnitByPlayId — which can never find an upgrade attached to a base. Both needed a path.
//
// "On top of your deck" means the END of the deck array: DrawCardForPlayer pops.

const BACTA = "HMW_037";
const TURTLE = Cards.units.ash.dinosaurTurtle; // 7/7 Ground Creature, no text, NOT a Vehicle
const SPEEDER = "IBH_004";                     // Rogue Squadron Speeder — a Vehicle
const MARINE = Cards.units.sor.battlefieldMarine;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

/** The Bacta Tank already attached to player 1's base. */
function attached() {
  return setup().WithUpgradesOnBaseForPlayer(1, [up(BACTA, 1)]);
}

const bactaPlayId = (g: GameTestAdapter) =>
  (g.state.player1.base.upgrades ?? []).find(u => u.cardId === BACTA)!.playId;

/** Discard entries carry real playIds, so the option id is the playId — two copies of the same
 *  card in the discard must be distinguishable. */
const discardPlayId = (g: GameTestAdapter, cardId: string) =>
  g.state.player1.discard.find(c => c.cardId === cardId)!.playId;

describe("HMW_037 Bacta Tank", () => {
  it("has Fortify", () => {
    expect(HasFortify(BACTA)).toBe(true);
  });

  describe("When Played: heal up to 3 from a non-Vehicle unit", () => {
    it("heals the chosen unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, TURTLE, true, 5)
          .WithCardInHandForPlayer(1, BACTA)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] }); // Fortify host
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.state.player1.groundArena[0].damage).toBe(2); // 5 - 3
    });

    it("caps the heal at the damage actually on the unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, TURTLE, true, 1)
          .WithCardInHandForPlayer(1, BACTA)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.state.player1.groundArena[0].damage).toBe(0); // not negative
    });

    it("does not offer a Vehicle", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, SPEEDER, true, 4)
          .WithGroundUnitForPlayer(1, TURTLE, true, 4)
          .WithCardInHandForPlayer(1, BACTA)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
      expect(pending?.type).toBe("Target");
      const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
      const speeder = g.state.player1.groundArena.find(u => u.cardId === SPEEDER)!;
      expect(offered).not.toContain(speeder.playId);
      expect(offered).toHaveLength(1);
    });

    it("attaches to the BASE, not a unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, BACTA).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      expect((g.state.player1.base.upgrades ?? []).map(u => u.cardId)).toEqual([BACTA]);
    });
  });

  describe("Action [defeat this upgrade]: discard -> top of deck", () => {
    it("puts the chosen unit on TOP of the deck", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        attached()
          .WithCardInDiscardForPlayer(1, TURTLE)
          .WithCardInDeckForPlayer(1, MARINE)
          .Build(),
      );

      await g.dispatchAsync(1, "use-ability", { playId: bactaPlayId(g), cardId: BACTA });
      await g.chooseOptionAsync(1, discardPlayId(g, TURTLE));

      const deck = g.state.player1.deck;
      expect(deck[deck.length - 1].cardId).toBe(TURTLE); // the end of the array is the top
      expect(g.state.player1.discard.some(c => c.cardId === TURTLE)).toBe(false);
    });

    it("defeats the Bacta Tank as its cost", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(attached().WithCardInDiscardForPlayer(1, TURTLE).Build());

      await g.dispatchAsync(1, "use-ability", { playId: bactaPlayId(g), cardId: BACTA });
      await g.chooseOptionAsync(1, discardPlayId(g, TURTLE));

      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
      expect(g.state.player1.discard.some(c => c.cardId === BACTA)).toBe(true);
    });

    it("does not offer a Vehicle from the discard", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        attached()
          .WithCardInDiscardForPlayer(1, SPEEDER)
          .WithCardInDiscardForPlayer(1, TURTLE)
          .Build(),
      );

      await g.dispatchAsync(1, "use-ability", { playId: bactaPlayId(g), cardId: BACTA });

      const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
      expect(pending?.type).toBe("Option");
      const offered = pending?.type === "Option" ? pending.options : [];
      expect(offered).toHaveLength(1);
    });

    it("is not usable with no non-Vehicle unit in the discard", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(attached().WithCardInDiscardForPlayer(1, SPEEDER).Build());

      await g.dispatchAsync(1, "use-ability", { playId: bactaPlayId(g), cardId: BACTA });

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(1); // cost not paid
    });

    it("only its controller can use it", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(attached().WithCardInDiscardForPlayer(1, TURTLE).Build());

      await g.dispatchAsync(2, "use-ability", { playId: bactaPlayId(g), cardId: BACTA });

      expect(g.state.player1.base.upgrades ?? []).toHaveLength(1);
    });
  });
});
