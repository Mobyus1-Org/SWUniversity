import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// TWI_015 General Grievous — General of the Droid Armies (Leader; deployed 4/8 Ground)
//   Leader side: "Action [Exhaust]: Give a Droid unit Sentinel for this phase."
//                "Epic Action: If you control 6 or more resources, deploy this leader."
//   Deployed:    "On Attack: You may give a Droid unit +1/+0 and Sentinel for this phase."
//
// "A Droid unit" is unqualified on both sides — an ENEMY Droid is a legal target too. Grievous
// himself is Separatist/Official with no Droid trait, so the deployed leader unit can never
// target itself.
//
// Sentinel is asserted through HasSentinel rather than by attacking: the engine's base-attack
// branch does not validate Sentinel, so a "blocked from hitting the base" test would fail for
// reasons unrelated to this card.

const GRIEVOUS = Cards.leaders.twi.generalGrievous;
const DROID = Cards.units.twi.superBattleDroid;   // 4/3 Ground Separatist/Droid/Trooper, no text
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground Rebel/Trooper — NOT a Droid

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Cunning — covers Grievous's own aspect
    .MyLeader(GRIEVOUS)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

const unitAt = (g: GameTestAdapter, player: 1 | 2, index: number) =>
  Unit.FromInterface(g.state[player === 1 ? "player1" : "player2"].groundArena[index]);

const sentinelOn = (g: GameTestAdapter, player: 1 | 2, index: number) => {
  const u = unitAt(g, player, index);
  return HasSentinel(u.cardId, u.playId, player);
};

describe("TWI_015 General Grievous", () => {
  describe("leader side — Action [Exhaust]: give a Droid unit Sentinel", () => {
    it("gives the chosen friendly Droid unit Sentinel", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, DROID).Build());
      expect(sentinelOn(g, 1, 0)).toBe(false); // control: no Sentinel before

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      expect(sentinelOn(g, 1, 0)).toBe(true);
    });

    it("grants Sentinel only to the chosen unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, DROID)
          .WithGroundUnitForPlayer(1, DROID)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      expect(sentinelOn(g, 1, 0)).toBe(true);
      expect(sentinelOn(g, 1, 1)).toBe(false);
    });

    it("can target an ENEMY Droid unit — 'a Droid unit' is unqualified", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, DROID).Build());

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(sentinelOn(g, 2, 0)).toBe(true);
    });

    it("does not offer a non-Droid unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, DROID)
          .WithGroundUnitForPlayer(1, MARINE) // not a Droid
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 1); // the Marine

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(sentinelOn(g, 1, 1)).toBe(false);
    });

    it("exhausts the leader and costs no resource", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, DROID).Build());

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.state.player1.leader.ready).toBe(false);
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(0);
    });

    it("is unavailable with no Droid unit in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.ready).toBe(true);
    });
  });

  describe("Epic Action — deploy at 6 or more resources", () => {
    /** setup() fills 14, so these override the resource count entirely. */
    function withResources(count: number) {
      return new GameStateBuilder()
        .MyBase(Cards.bases.common.yellow30HP)
        .MyLeader(GRIEVOUS)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, count)
        .WithActivePlayer(1);
    }

    it("deploys while controlling 6 resources, spending none of them", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(withResources(6).Build());

      await g.deployLeaderAsync(1);

      expect(g.state.player1.leader.deployed).toBe(true);
      expect(g.state.player1.groundArena.some(u => u.cardId === GRIEVOUS)).toBe(true);
      // "If you control 6 or more resources" is a condition, not a cost — nothing is exhausted.
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(0);
    });

    it("cannot deploy on 5 resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(withResources(5).Build());

      await g.deployLeaderAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.deployed).toBe(false);
    });
  });

  describe("deployed side — On Attack: may give a Droid unit +1/+0 and Sentinel", () => {
    /**
     * Deploys Grievous, hands the turn back, then attacks the enemy base with him — stopping once
     * the attack target is locked in, which is when the On Attack trigger prompts.
     */
    async function deployAndAttack(builder: GameStateBuilder): Promise<GameTestAdapter> {
      const g = new GameTestAdapter();
      g.loadNewState(builder.Build());

      await g.deployLeaderAsync(1); // Epic Action — needs 6+ resources, we have 14
      await g.dispatchAsync(2, "pass-action", {});
      const grievousIndex = g.state.player1.groundArena.findIndex(u => u.cardId === GRIEVOUS);
      await g.attackWithGroundUnitAsync(1, grievousIndex);
      await g.chooseBaseAsync(1, 2);
      return g;
    }

    it("accepting gives the chosen Droid +1/+0 and Sentinel", async () => {
      const g = await deployAndAttack(setup().WithGroundUnitForPlayer(1, DROID));

      await g.chooseYesAsync(1);
      const droidIndex = g.state.player1.groundArena.findIndex(u => u.cardId === DROID);
      await g.chooseGroundUnitAsync(1, droidIndex);

      const droid = g.state.player1.groundArena.find(u => u.cardId === DROID)!;
      expect(Unit.FromInterface(droid).CurrentPower()).toBe(5); // 4 + 1
      expect(HasSentinel(droid.cardId, droid.playId, 1)).toBe(true);
    });

    it("declining grants nothing", async () => {
      const g = await deployAndAttack(setup().WithGroundUnitForPlayer(1, DROID));

      // The prompt must actually exist — dispatching an option with no pending is a silent no-op,
      // so without this the test would pass even if the trigger never fired.
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

      await g.chooseNoAsync(1);

      const droid = g.state.player1.groundArena.find(u => u.cardId === DROID)!;
      expect(Unit.FromInterface(droid).CurrentPower()).toBe(4);
      expect(HasSentinel(droid.cardId, droid.playId, 1)).toBe(false);
    });

    it("can target an ENEMY Droid unit", async () => {
      const g = await deployAndAttack(setup().WithGroundUnitForPlayer(2, DROID));

      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      const droid = g.state.player2.groundArena[0];
      expect(Unit.FromInterface(droid).CurrentPower()).toBe(5);
      expect(HasSentinel(droid.cardId, droid.playId, 2)).toBe(true);
    });

    it("does not fire with no Droid unit in play — Grievous is not a Droid himself", async () => {
      const g = await deployAndAttack(setup().WithGroundUnitForPlayer(1, MARINE));

      // No legal target, so no prompt at all — the attack simply resolves.
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
      expect(g.state.player2.base.damage).toBe(4); // Grievous's 4 power landed
    });
  });
});
