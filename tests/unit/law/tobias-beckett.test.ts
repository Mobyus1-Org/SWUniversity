import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_002 Tobias Beckett — People are Predictable.
//
// Leader side:   "Action [Exhaust]: Choose a friendly unit. An opponent takes control of it.
//                 If they do, create a Credit token."
// Deployed side: "When Deployed: Defeat any number of units you own but don't control. For each
//                 unit defeated this way, create a Credit token and draw a card."
//
// The two sides are a loop: give units away for Credits, deploy, then reclaim them for more
// Credits and cards. "own but don't control" is the key filter on the deployed half — a unit you
// both own and control is NOT a legal target.

const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInDeckForPlayer(1, CSF)
    .WithCardInDeckForPlayer(1, CSF)
    .WithCardInDeckForPlayer(1, CSF);
}

describe("LAW_002 Tobias Beckett", () => {
  describe("leader side — give a unit away for a Credit", () => {
    it("hands the chosen friendly unit to the opponent and creates a Credit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .MyLeader(Cards.leaders.law.tobiasBeckett)
          .WithGroundUnitForPlayer(1, MARINE)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.state.player1.groundArena).toHaveLength(0);
      expect(g.state.player2.groundArena.some(u => u.cardId === MARINE)).toBe(true);
      expect(g.state.player1.supplemental.creditTokens).toBe(1);
      expect(g.state.player1.leader.ready).toBe(false); // Action [Exhaust]
    });

    it("keeps the original owner on the transferred unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .MyLeader(Cards.leaders.law.tobiasBeckett)
          .WithGroundUnitForPlayer(1, MARINE)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      const given = g.state.player2.groundArena.find(u => u.cardId === MARINE)!;
      expect(given.owner).toBe(1);
      expect(given.controller).toBe(2);
    });

    it("is unavailable with no friendly unit to give away", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .MyLeader(Cards.leaders.law.tobiasBeckett)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.ready).toBe(true); // not spent
      expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);
    });
  });

  describe("deployed side — reclaim units you own but don't control", () => {
    function deployedSetup() {
      // Undeployed: the Epic Action does the deploying, and only then does When Deployed fire.
      const state = baseSetup()
        .MyLeader(Cards.leaders.law.tobiasBeckett)
        .WithGroundUnitForPlayer(1, CSF) // owned AND controlled — not a legal target
        .Build();
      // Two units player 1 owns but player 2 controls (previously given away).
      state.player2.groundArena.push(
        { cardId: MARINE, playId: "given-1", owner: 1, controller: 2, ready: true, damage: 0, upgrades: [], captives: [], numUses: 1, isClone: false },
        { cardId: MARINE, playId: "given-2", owner: 1, controller: 2, ready: true, damage: 0, upgrades: [], captives: [], numUses: 1, isClone: false },
      );
      return state;
    }

    it("defeats the chosen owned-but-uncontrolled units for a Credit and a card each", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(deployedSetup());
      const handBefore = g.state.player1.hand.length;

      await g.deployLeaderAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["given-1", "given-2"] });

      expect(g.state.player2.groundArena.some(u => u.playId === "given-1")).toBe(false);
      expect(g.state.player2.groundArena.some(u => u.playId === "given-2")).toBe(false);
      expect(g.state.player1.supplemental.creditTokens).toBe(2);
      expect(g.state.player1.hand).toHaveLength(handBefore + 2);
    });

    it("accepts zero units ('any number')", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(deployedSetup());
      const handBefore = g.state.player1.hand.length;

      await g.deployLeaderAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(g.state.player2.groundArena).toHaveLength(2);
      expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);
      expect(g.state.player1.hand).toHaveLength(handBefore);
    });

    it("cannot target a unit you own AND control", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(deployedSetup());

      await g.deployLeaderAsync(1);
      const ownAndControl = g.state.player1.groundArena.find(u => u.cardId === CSF)!;
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [ownAndControl.playId] });

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.groundArena.some(u => u.cardId === CSF)).toBe(true);
    });

    it("does not prompt when no owned-but-uncontrolled unit exists", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        baseSetup()
          .MyLeader(Cards.leaders.law.tobiasBeckett)
          .WithGroundUnitForPlayer(1, CSF)
          .Build(),
      );

      await g.deployLeaderAsync(1);

      expect(g.state.player1.leader.deployed).toBe(true); // the deploy really happened
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);
    });
  });
});
