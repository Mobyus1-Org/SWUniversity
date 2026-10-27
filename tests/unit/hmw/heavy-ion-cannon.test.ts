import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasFortify } from "@/server/engine/card-db/keyword-dictionaries.ts/fortify";

// HMW_172 Heavy Ion Cannon (Upgrade, cost 3, Aggression/Heroism, Fortification) —
//   "Fortify (Attach this to your base, not a unit.)"
//   "When Played: Draw a card."
//   "Attached base gains: 'Action [discard a card from your hand]: Deal 2 damage to a unit. Use
//    this ability only once each phase.'"
//
// The Action is hosted by an upgrade on a BASE (the Bacta Tank path), but its cost is a hand
// discard rather than defeating itself, and it is limited per phase — keyed by the upgrade, so it
// is available again in the next action phase. The cost needs only a card in hand: with no unit in
// play the discard is still paid and the damage simply has nowhere to go.

const CANNON = Cards.upgrades.hmw.heavyIonCannon;
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7 Ground, no abilities
const WAMPA = Cards.units.sor.wampa;                // hand filler
const SHIELD = Cards.upgrades.token.shield;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithActivePlayer(1);
}

/** The Cannon already attached to player 1's base, P2 with a durable unit to shoot at. */
function attached() {
  return setup()
    .WithUpgradesOnBaseForPlayer(1, [up(CANNON, 1)])
    .WithGroundUnitForPlayer(2, CSF);
}

const cannonPlayId = (g: GameTestAdapter) =>
  (g.state.player1.base.upgrades ?? []).find(u => u.cardId === CANNON)!.playId;
const prompt = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as
  { type?: string; fromZones?: string[]; fromPlayIds?: string[] } | undefined;
const isHandDiscardPrompt = (g: GameTestAdapter) =>
  prompt(g)?.type === "Target" && (prompt(g)?.fromZones ?? []).includes("Hand");

async function activateCannon(g: GameTestAdapter) {
  await g.dispatchAsync(1, "use-ability", { playId: cannonPlayId(g), cardId: CANNON });
}

describe("HMW_172 Heavy Ion Cannon", () => {
  it("has Fortify", () => {
    expect(HasFortify(CANNON)).toBe(true);
  });

  describe("When Played: draw a card", () => {
    it("attaches to the base and draws a card", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithCardInHandForPlayer(1, CANNON)
          .WithCardInDeckForPlayer(1, WAMPA)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] }); // Fortify host

      expect((g.state.player1.base.upgrades ?? []).map(u => u.cardId)).toEqual([CANNON]);
      expect(g.state.player1.hand.map(c => c.cardId)).toEqual([WAMPA]);
      expect(g.state.player1.deck).toHaveLength(0);
    });

    it("drawing from an empty deck deals 3 damage to its controller's base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, CANNON).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      expect(g.state.player1.base.damage).toBe(3);
    });
  });

  describe("Action [discard a card from your hand]: deal 2 damage to a unit", () => {
    it("discards the chosen card, then deals 2 damage to the chosen enemy unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        attached()
          .WithCardInHandForPlayer(1, MARINE)
          .WithCardInHandForPlayer(1, WAMPA)
          .Build(),
      );

      await activateCannon(g);
      expect(isHandDiscardPrompt(g)).toBe(true);
      await g.chooseCardFromHandAsync(1, 1); // the Wampa

      expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
      expect(g.state.player1.discard.map(c => c.cardId)).toEqual([WAMPA]);

      const csf = g.state.player2.groundArena[0];
      expect(prompt(g)?.type).toBe("Target");
      expect(prompt(g)?.fromPlayIds).toContain(csf.playId);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [csf.playId] });

      expect(g.state.player2.groundArena[0].damage).toBe(2);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      // The upgrade stays on the base — the cost is the discard, not the Cannon.
      expect((g.state.player1.base.upgrades ?? []).map(u => u.cardId)).toEqual([CANNON]);
    });

    it("may target a friendly unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        attached()
          .WithGroundUnitForPlayer(1, CSF)
          .WithCardInHandForPlayer(1, WAMPA)
          .Build(),
      );

      await activateCannon(g);
      await g.chooseCardFromHandAsync(1, 0);
      const mine = g.state.player1.groundArena[0];
      expect(prompt(g)?.fromPlayIds).toContain(mine.playId);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [mine.playId] });

      expect(g.state.player1.groundArena[0].damage).toBe(2);
      expect(g.state.player2.groundArena[0].damage).toBe(0);
    });

    it("defeats a unit the 2 damage finishes off", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithUpgradesOnBaseForPlayer(1, [up(CANNON, 1)])
          .WithGroundUnitForPlayer(2, MARINE, true, 1)
          .WithCardInHandForPlayer(1, WAMPA)
          .Build(),
      );

      await activateCannon(g);
      await g.chooseCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

      expect(g.state.player2.groundArena).toHaveLength(0);
      expect(g.state.player2.discard.map(c => c.cardId)).toContain(MARINE);
    });

    it("a Shield token absorbs the damage (control: the unshielded unit takes it)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        attached()
          .WithGroundUnitForPlayer(2, CSF)
          .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(SHIELD, 2)])
          .WithCardInHandForPlayer(1, WAMPA)
          .Build(),
      );

      await activateCannon(g);
      await g.chooseCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

      expect(g.state.player2.groundArena[0].damage).toBe(0);
      expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0); // the Shield is spent
      expect(g.state.player2.groundArena[1].damage).toBe(0);
    });

    it("with no unit in play the discard is still paid", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithUpgradesOnBaseForPlayer(1, [up(CANNON, 1)])
          .WithCardInHandForPlayer(1, WAMPA)
          .Build(),
      );

      await activateCannon(g);
      expect(isHandDiscardPrompt(g)).toBe(true);
      await g.chooseCardFromHandAsync(1, 0);

      expect(g.state.player1.hand).toHaveLength(0);
      expect(g.state.player1.discard.map(c => c.cardId)).toEqual([WAMPA]);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    });

    it("is not usable with an empty hand", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(attached().Build());

      await activateCannon(g);

      expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(g.state.activePlayer).toBe(1); // the action was refused, not spent
    });

    it("only its controller can use it", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(attached().WithCardInHandForPlayer(2, WAMPA).WithActivePlayer(2).Build());

      await g.dispatchAsync(2, "use-ability", { playId: cannonPlayId(g), cardId: CANNON });

      expect(isHandDiscardPrompt(g)).toBe(false);
      expect(g.state.player2.hand).toHaveLength(1);
    });
  });

  describe("Use this ability only once each phase", () => {
    async function activateOnce(g: GameTestAdapter) {
      await activateCannon(g);
      await g.chooseCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    }

    it("refuses a second use in the same phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        attached()
          .WithCardInHandForPlayer(1, WAMPA)
          .WithCardInHandForPlayer(1, WAMPA)
          .Build(),
      );

      await activateOnce(g);
      await g.dispatchAsync(2, "pass-action", {});
      // Control: the first use went through.
      expect(g.state.player2.groundArena[0].damage).toBe(2);

      await activateCannon(g);

      expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
      expect(isHandDiscardPrompt(g)).toBe(false);
      expect(g.state.player1.hand).toHaveLength(1); // nothing discarded
      expect(g.state.player2.groundArena[0].damage).toBe(2);
    });

    it("is available again in the next action phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        attached()
          .WithCardInHandForPlayer(1, WAMPA)
          .WithCardInHandForPlayer(1, WAMPA)
          .WithCardInDeckForPlayer(1, WAMPA)
          .WithCardInDeckForPlayer(1, WAMPA)
          .WithCardInDeckForPlayer(2, WAMPA)
          .WithCardInDeckForPlayer(2, WAMPA)
          .Build(),
      );

      await activateOnce(g);
      await g.dispatchAsync(2, "pass-action", {});
      await g.dispatchAsync(1, "pass-action", {});
      await g.dispatchAsync(2, "pass-action", {});
      await g.passResourceAsync(1);
      await g.passResourceAsync(2);
      expect(g.state.gamePhase).toBe("ActionPhase");
      expect(g.state.activePlayer).toBe(1);

      await activateCannon(g);
      expect(isHandDiscardPrompt(g)).toBe(true);
      await g.chooseCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

      expect(g.state.player2.groundArena[0].damage).toBe(4);
    });
  });
});
