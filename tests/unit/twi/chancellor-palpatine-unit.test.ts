import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_203 Chancellor Palpatine — Wartime Chancellor (2/6 Ground, cost 4, Cunning/Cunning,
// Republic/Official). The UNIT, not TWI_017 the leader.
//   "Each token unit you create enters play ready."
//   "On Attack: If a unit left play this phase, create a Clone Trooper token."
//
// Tokens normally enter play EXHAUSTED (spawnToken), so the first clause is a constant ability
// read at creation time. The two clauses meet on his own attack: the Clone Trooper he creates
// must itself enter ready.

const CHANCELLOR = Cards.units.twi.wartimeChancellor;
const ESCORT = Cards.units.twi.battleDroidEscort; // When Played: create a Battle Droid token
const BATTLE_DROID = Cards.units.token.battleDroid;
const CLONE_TROOPER = Cards.units.token.cloneTrooper;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Cunning
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithActivePlayer(1);
}

const tokenIn = (g: GameTestAdapter, player: 1 | 2, cardId: string) =>
  (player === 1 ? g.state.player1 : g.state.player2).groundArena.find(u => u.cardId === cardId);

describe("TWI_203 Chancellor Palpatine (Wartime Chancellor)", () => {
  describe("Each token unit you create enters play ready", () => {
    it("a token created while he is in play enters READY", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, CHANCELLOR)
          .WithCardInHandForPlayer(1, ESCORT)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0); // Escort's When Played creates a Battle Droid

      expect(tokenIn(g, 1, BATTLE_DROID)!.ready).toBe(true);
    });

    it("control: without him the same token enters EXHAUSTED", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, ESCORT).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(tokenIn(g, 1, BATTLE_DROID)!.ready).toBe(false);
    });

    it("only YOUR tokens — an opponent's token still enters exhausted", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, CHANCELLOR)
          .WithCardInHandForPlayer(2, ESCORT)
          .Build(),
      );

      await g.dispatchAsync(1, "pass-action", {});
      await g.playCardFromHandAsync(2, 0);

      expect(tokenIn(g, 2, BATTLE_DROID)!.ready).toBe(false);
    });

    it("stops applying once he leaves play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, CHANCELLOR, true, 5) // 1 HP left of 6
          .WithGroundUnitForPlayer(2, MARINE)              // 3 power — finishes him
          .WithCardInHandForPlayer(1, ESCORT)
          .Build(),
      );

      await g.dispatchAsync(1, "pass-action", {});
      await g.attackWithGroundUnitAsync(2, 0);
      await g.chooseGroundUnitAsync(1, 0); // kill the Chancellor
      expect(g.state.player1.groundArena.some(u => u.cardId === CHANCELLOR)).toBe(false);

      await g.playCardFromHandAsync(1, 0);

      expect(tokenIn(g, 1, BATTLE_DROID)!.ready).toBe(false);
    });
  });

  describe("On Attack: if a unit left play this phase, create a Clone Trooper", () => {
    /** Kills an enemy Battle Droid so a unit has left play, then hands the turn back to P1. */
    async function withAUnitHavingLeftPlay(builder: GameStateBuilder): Promise<GameTestAdapter> {
      const g = new GameTestAdapter();
      g.loadNewState(builder.WithGroundUnitForPlayer(2, BATTLE_DROID).Build());

      const marineIndex = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
      await g.attackWithGroundUnitAsync(1, marineIndex);
      await g.chooseGroundUnitAsync(2, 0); // the 1/1 Battle Droid dies
      await g.dispatchAsync(2, "pass-action", {});
      return g;
    }

    it("creates a Clone Trooper, and his own static makes it enter READY", async () => {
      const g = await withAUnitHavingLeftPlay(
        setup()
          .WithGroundUnitForPlayer(1, CHANCELLOR)
          .WithGroundUnitForPlayer(1, MARINE),
      );

      const chancellorIndex = g.state.player1.groundArena.findIndex(u => u.cardId === CHANCELLOR);
      await g.attackWithGroundUnitAsync(1, chancellorIndex);
      await g.chooseBaseAsync(1, 2);

      const trooper = tokenIn(g, 1, CLONE_TROOPER);
      expect(trooper).toBeDefined();
      expect(trooper!.ready).toBe(true); // both clauses, together
      expect(g.state.player2.base.damage).toBe(2); // the attack still landed
    });

    it("soft-passes when no unit left play this phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, CHANCELLOR).Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(tokenIn(g, 1, CLONE_TROOPER)).toBeUndefined();
      expect(g.state.player2.base.damage).toBe(2);
    });

    it("a unit leaving play on EITHER side counts — the text says 'a unit'", async () => {
      const g = new GameTestAdapter();
      // A friendly Battle Droid dies to the enemy Marine, then P1 attacks with the Chancellor.
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, CHANCELLOR)
          .WithGroundUnitForPlayer(1, BATTLE_DROID)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.dispatchAsync(1, "pass-action", {});
      const droidIndex = g.state.player1.groundArena.findIndex(u => u.cardId === BATTLE_DROID);
      await g.attackWithGroundUnitAsync(2, 0);
      await g.chooseGroundUnitAsync(1, droidIndex); // the friendly Battle Droid dies

      const chancellorIndex = g.state.player1.groundArena.findIndex(u => u.cardId === CHANCELLOR);
      await g.attackWithGroundUnitAsync(1, chancellorIndex);
      await g.chooseBaseAsync(1, 2);

      expect(tokenIn(g, 1, CLONE_TROOPER)).toBeDefined();
    });
  });
});
