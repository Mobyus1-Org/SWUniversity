import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_011 Governor Pryce — Tyrant of Lothal (Leader)
//   Leader side: "Action [1 resource, Exhaust]: Ready a token unit."
//   Deployed:    "This unit gets +1/+0 for each ready friendly token unit.
//                 On Attack: Create a Spy token."
//
// Both halves revolve around TOKEN units. The deployed buff is dynamic and counts only READY
// friendly tokens, so it moves as tokens exhaust and ready.

const MARINE = Cards.units.sor.battlefieldMarine;
const PRYCE = Cards.leaders.sec.governorPryce;
const SPY = Cards.units.token.spy;
const CLONE = Cards.units.token.cloneTrooper;

function setup(resources = 12) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources);
}

describe("SEC_011 Governor Pryce", () => {
  describe("leader side — Action [1 resource, Exhaust]: Ready a token unit", () => {
    it("readies the chosen exhausted token unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup().MyLeader(PRYCE)
          .WithGroundUnitForPlayer(1, CLONE, false) // exhausted token
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.state.player1.groundArena[0].ready).toBe(true);
      expect(g.state.player1.leader.ready).toBe(false);
    });

    it("is unavailable with no token unit in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup().MyLeader(PRYCE)
          .WithGroundUnitForPlayer(1, MARINE, false) // exhausted, but NOT a token
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.ready).toBe(true);
    });
  });

  describe("deployed side", () => {
    it("gets +1/+0 for each READY friendly token unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(20).MyLeader(PRYCE, true, true)
          .WithGroundUnitForPlayer(1, PRYCE)          // the deployed leader unit
          .WithGroundUnitForPlayer(1, CLONE, true)    // ready token  -> +1
          .WithGroundUnitForPlayer(1, SPY, true)      // ready token  -> +1
          .WithGroundUnitForPlayer(1, CLONE, false)   // EXHAUSTED    -> no bonus
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      // Spy's On Attack fires too — answer nothing, it is targetless.

      // Printed power 4 + 2 ready tokens = 6.
      expect(g.state.player2.base.damage).toBe(6);
    });

    it("creates a Spy token on attack", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(20).MyLeader(PRYCE, true, true)
          .WithGroundUnitForPlayer(1, PRYCE)
          .Build(),
      );
      const spiesBefore = g.state.player1.groundArena.filter(u => u.cardId === SPY).length;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player1.groundArena.filter(u => u.cardId === SPY).length).toBe(spiesBefore + 1);
    });

    it("gets no bonus with no friendly tokens (control)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(20).MyLeader(PRYCE, true, true)
          .WithGroundUnitForPlayer(1, PRYCE)
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      // Printed power only — the Spy it creates arrives AFTER the attack's damage is set.
      expect(g.state.player2.base.damage).toBe(4);
    });
  });
});
