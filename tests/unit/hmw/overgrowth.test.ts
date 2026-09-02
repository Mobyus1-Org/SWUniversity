import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_151 Overgrowth (Event, cost 5, Command, Disaster) —
//   "If you control a Kashyyyk base, a friendly unit deals damage equal to its power to an enemy
//    unit."
//   "Resource this card."
//
// "Resource this card" appears on no other card in the pool, so this is a new mechanic: the event
// ends up in the RESOURCE area instead of the discard pile. It is a separate sentence from the
// conditional, so it happens either way — including when you hold no Kashyyyk base and the first
// half does nothing at all. That independence is the main thing these tests pin.
//
// "A friendly unit DEALS damage equal to its power" — the amount is read off the chosen unit, so a
// buffed unit hits harder; a hardcoded number would pass a single-fixture test and fail here.

const OVERGROWTH = "HMW_151";
const KASHYYYK_BASE = "HMW_021";                  // Kachirho
const PLAIN_BASE = Cards.bases.common.green30HP;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const CSF = Cards.units.sor.consularSecurityForce; // 3/7
const EXPERIENCE = Cards.upgrades.token.experience;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup(myBase: string = KASHYYYK_BASE) {
  return new GameStateBuilder()
    .MyBase(myBase)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, OVERGROWTH)
    .WithActivePlayer(1);
}

const inResources = (g: GameTestAdapter) =>
  g.state.player1.resources.filter(r => r.cardId === OVERGROWTH);

describe("HMW_151 Overgrowth", () => {
  describe("the damage half", () => {
    it("a friendly unit deals its power to the chosen enemy unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);  // the 3/3 Marine deals damage
      await g.chooseGroundUnitAsync(2, 0);  // to the 3/7

      expect(g.state.player2.groundArena[0].damage).toBe(3);
    });

    it("reads the power off the CHOSEN unit, buffs included", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(EXPERIENCE, 1)]) // 3/3 → 4/4
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(4);
    });

    it("only FRIENDLY units are offered as the source", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
      expect(pending?.type).toBe("Target");
      const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
      expect(offered).toEqual([g.state.player1.groundArena[0].playId]);
    });

    it("only ENEMY units are offered as the victim", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(1, CSF)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);

      const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
      const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
      expect(offered).toEqual([g.state.player2.groundArena[0].playId]);
    });

    it("kills the victim outright when the power is enough, and sweeps it", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena).toHaveLength(0);
    });

    it("does nothing without a Kashyyyk base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(PLAIN_BASE)
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(g.state.player2.groundArena[0].damage).toBe(0);
    });
  });

  describe("Resource this card", () => {
    it("ends up in the resource area, not the discard pile", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, CSF)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);

      expect(inResources(g)).toHaveLength(1);
      expect(g.state.player1.discard.map(c => c.cardId)).not.toContain(OVERGROWTH);
    });

    it("is resourced even when the Kashyyyk half does nothing", async () => {
      // The two sentences are independent; the resourcing is not part of the conditional.
      const g = new GameTestAdapter();
      g.loadNewState(setup(PLAIN_BASE).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(inResources(g)).toHaveLength(1);
      expect(g.state.player1.discard.map(c => c.cardId)).not.toContain(OVERGROWTH);
    });

    it("the new resource enters exhausted", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(PLAIN_BASE).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(inResources(g)[0].ready).toBe(false);
    });

    it("raises the resource count by one", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(PLAIN_BASE).Build());
      const before = g.state.player1.resources.length;

      await g.playCardFromHandAsync(1, 0);

      expect(g.state.player1.resources.length).toBe(before + 1);
    });
  });
});
