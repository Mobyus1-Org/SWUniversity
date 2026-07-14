import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds, OptionText } from "../../test-helpers";

// LAW_013 Chewbacca (Hero of Kessel) — Leader (Aggression/Heroism), cost 4, deployed 5/6
// Leader side:
//   "Action [1 resource, Exhaust, defeat a friendly resource]: Deal 2 damage to a unit and
//    create a Credit token."
//   "Epic Action [4 resources]: Deploy this leader."
// Deployed side:
//   "On Attack: You may defeat a friendly resource. If you do, deal 2 damage to a unit and
//    create a Credit token."

function creditsOf(g: GameTestAdapter, player: 1 | 2 = 1): number {
  return (player === 1 ? g.state.player1 : g.state.player2).supplemental.creditTokens ?? 0;
}

function leaderSetup(resourceCount = 5) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.law.chewbacca)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resourceCount)
    .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce); // 6/8 — survives 2 damage
}

describe("LAW_013 Chewbacca (Hero of Kessel)", () => {
  describe("leader side — Action [1 resource, Exhaust, defeat a friendly resource]", () => {
    it("prompts for a friendly resource to defeat", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup().Build();
      g.loadNewState(state);

      await g.useLeaderAbilityAsync(1);

      const targets = TargetIds(g);
      const resourceIds = state.player1.resources.map(r => r.playId);
      expect(targets.sort()).toEqual(resourceIds.sort()); // only friendly resources
    });

    it("defeats the chosen resource, deals 2 damage, and creates a Credit token", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup().Build();
      g.loadNewState(state);

      const doomedResource = state.player1.resources[0].playId;
      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [doomedResource] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      expect(g.state.player1.resources).toHaveLength(4); // 5 - 1 defeated
      expect(g.state.player1.resources.some(r => r.playId === doomedResource)).toBe(false);
      expect(g.state.player1.discard.some(c => c.playId === doomedResource)).toBe(true);
      expect(g.state.player2.groundArena[0].damage).toBe(2);
      expect(creditsOf(g)).toBe(1);
      expect(g.state.player1.leader.ready).toBe(false); // Exhaust cost
    });

    it("pays the 1-resource cost on top of the defeated resource", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup().Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.useLeaderAbilityAsync(1);
      // Defeat a resource OTHER than the one exhausted to pay the cost, so both costs are visible.
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.resources[1].playId] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      // One resource is exhausted to pay the cost; a different one is gone entirely.
      expect(g.state.player1.resources).toHaveLength(4);
      expect(g.state.player1.resources.filter(r => !r.ready)).toHaveLength(1);
    });

    it("allows defeating the very resource that paid the cost", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup().Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.useLeaderAbilityAsync(1);
      // resources[0] is the one payResources exhausts — defeating it is legal.
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.resources[0].playId] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      expect(g.state.player1.resources).toHaveLength(4);
      expect(g.state.player1.resources.every(r => r.ready)).toBe(true); // the exhausted one is gone
      expect(creditsOf(g)).toBe(1);
    });

    it("can damage a friendly unit ('a unit' — either side)", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.priestessesOfTheForce)
        .Build();
      g.loadNewState(state);

      const friendlyPlayId = state.player1.groundArena[0].playId;

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.resources[0].playId] });

      expect(TargetIds(g)).toContain(friendlyPlayId);

      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] });
      expect(g.state.player1.groundArena[0].damage).toBe(2);
    });

    it("is unavailable with no resources to defeat", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(leaderSetup(0).Build());

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });
  });

  describe("Epic Action [4 resources] — Deploy this leader", () => {
    it("cannot deploy with fewer than 4 resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(leaderSetup(3).Build());

      await g.deployLeaderAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.deployed).toBe(false);
    });

    it("deploys as a unit with 4 resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(leaderSetup(4).Build());

      await g.deployLeaderAsync(1);

      expect(g.state.player1.leader.deployed).toBe(true);
      expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.law.chewbacca)).toBe(true);
    });
  });

  describe("deployed side — On Attack: You may defeat a friendly resource", () => {
    function deployedSetup(resourceCount = 5) {
      return new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.law.chewbacca, true, true) // deployed
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resourceCount)
        .WithGroundUnitForPlayer(1, Cards.leaders.law.chewbacca) // the leader unit
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce);
    }

    it("offers the option on attack, and accepting defeats a resource, deals 2, and creates a Credit", async () => {
      const g = new GameTestAdapter();
      const state = deployedSetup().Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;
      const doomedResource = state.player1.resources[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] }); // attack target

      expect(OptionText(g)).toContain("defeat a friendly resource");
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [doomedResource] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] }); // damage target

      expect(g.state.player1.resources).toHaveLength(4);
      expect(creditsOf(g)).toBe(1);
      // 2 from the ability + 5 combat damage from Chewbacca's power
      expect(g.state.player2.groundArena[0].damage).toBe(7);
    });

    it("declining skips the ability but still resolves the attack", async () => {
      const g = new GameTestAdapter();
      const state = deployedSetup().Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      expect(OptionText(g)).toContain("defeat a friendly resource");
      await g.chooseNoAsync(1);

      expect(g.state.player1.resources).toHaveLength(5); // nothing defeated
      expect(creditsOf(g)).toBe(0);
      expect(g.state.player2.groundArena[0].damage).toBe(5); // combat damage only
    });

    it("does not offer the option with no resources to defeat", async () => {
      const g = new GameTestAdapter();
      const state = deployedSetup(0).Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      expect(OptionText(g)).not.toContain("defeat a friendly resource");
      expect(g.state.player2.groundArena[0].damage).toBe(5); // attack still resolved
    });
  });
});
