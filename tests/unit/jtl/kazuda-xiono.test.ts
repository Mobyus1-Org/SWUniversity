import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";
import { Unit } from "@/server/engine/unit";
import type { Unit as UnitInterface } from "@/lib/engine/core-models";

// JTL_018 Kazuda Xiono (Best Pilot in the Galaxy) — Leader (Cunning/Heroism), cost 4, deployed 2/5
// Leader side:
//   "Action [Exhaust]: A friendly unit loses all abilities for this round. Take an extra action
//    after this one."
//   "Epic Action: If you control 4 or more resources, choose one:
//     Deploy this leader. / Deploy this leader as an upgrade on a friendly Vehicle unit without
//     a Pilot on it."
// Deployed side (and as a Pilot upgrade):
//   "On Attack: Choose any number of friendly units. They lose all abilities for this round."

function lostAbilities(u: UnitInterface): boolean {
  return Unit.FromInterface(u).LostAbilities();
}

/** Look a unit up by playId — arena indices shift when a unit is defeated mid-attack. */
function unitById(g: GameTestAdapter, playId: string): UnitInterface {
  const all = [
    ...g.state.player1.groundArena, ...g.state.player1.spaceArena,
    ...g.state.player2.groundArena, ...g.state.player2.spaceArena,
  ];
  return all.find(u => u.playId === playId)!;
}

function leaderSetup(resourceCount = 5) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.jtl.kazudaXiono)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resourceCount);
}

describe("JTL_018 Kazuda Xiono", () => {
  describe("leader side — 'A friendly unit loses all abilities for this round.'", () => {
    it("targets only friendly units", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.useLeaderAbilityAsync(1);

      const targets = TargetIds(g);
      expect(targets).toContain(state.player1.groundArena[0].playId);
      expect(targets).not.toContain(state.player2.groundArena[0].playId);
    });

    it("makes the chosen friendly unit lose all abilities", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
        .Build();
      g.loadNewState(state);

      const oggdoPlayId = state.player1.groundArena[0].playId;
      expect(lostAbilities(g.state.player1.groundArena[0])).toBe(false);

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [oggdoPlayId] });

      expect(lostAbilities(g.state.player1.groundArena[0])).toBe(true);
      expect(g.state.player1.leader.ready).toBe(false); // Exhaust cost
    });

    it("silences the ability in practice — an undamaged Oggdo Bogdo may then attack", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup()
        // Oggdo Bogdo normally "can't attack unless it's damaged"; silencing removes that.
        .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo, true, 0)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[0].playId] });

      await g.attackWithGroundUnitAsync(1, 0);

      expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    });

    it("is unavailable with no friendly unit to target", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(leaderSetup().Build()); // no units

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });
  });

  describe("leader side — 'Take an extra action after this one.'", () => {
    it("keeps priority with the acting player instead of passing the turn", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
        .Build();
      g.loadNewState(state);
      expect(g.state.activePlayer).toBe(1);

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[0].playId] });

      expect(g.state.activePlayer).toBe(1); // extra action — still player 1's turn
    });

    it("is consumed once — the action AFTER the extra one passes the turn normally", async () => {
      const g = new GameTestAdapter();
      const state = leaderSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo, true, 1) // damaged → can attack
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce)
        .Build();
      g.loadNewState(state);

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[0].playId] });
      expect(g.state.activePlayer).toBe(1);

      // The extra action itself: attack. Afterwards the turn passes as usual.
      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player2.groundArena[0].playId] });

      expect(g.state.activePlayer).toBe(2);
    });
  });

  describe("deployed side — 'On Attack: Choose any number of friendly units.'", () => {
    function deployedSetup() {
      return new GameStateBuilder()
        .MyBase(Cards.bases.common.yellow30HP)
        .MyLeader(Cards.leaders.jtl.kazudaXiono, true, true) // deployed
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithGroundUnitForPlayer(1, Cards.leaders.jtl.kazudaXiono) // the leader unit
        .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
        .WithGroundUnitForPlayer(1, Cards.units.lof.priestessesOfTheForce)
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce);
    }

    it("silences every chosen friendly unit", async () => {
      const g = new GameTestAdapter();
      const state = deployedSetup().Build();
      g.loadNewState(state);

      const oggdo = state.player1.groundArena[1].playId;
      const priestesses = state.player1.groundArena[2].playId;
      const enemy = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] }); // attack target
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [oggdo, priestesses] }); // multi-select

      expect(lostAbilities(unitById(g, oggdo))).toBe(true);
      expect(lostAbilities(unitById(g, priestesses))).toBe(true);
      expect(unitById(g, enemy).damage).toBe(2); // the attack still resolved
    });

    it("offers only friendly units", async () => {
      const g = new GameTestAdapter();
      const state = deployedSetup().Build();
      g.loadNewState(state);

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player2.groundArena[0].playId] });

      const targets = TargetIds(g);
      expect(targets).toContain(state.player1.groundArena[1].playId);
      expect(targets).not.toContain(state.player2.groundArena[0].playId);
    });

    it("accepts zero units ('any number') and still resolves the attack", async () => {
      const g = new GameTestAdapter();
      const state = deployedSetup().Build();
      g.loadNewState(state);

      const enemy = state.player2.groundArena[0].playId;

      const oggdo = state.player1.groundArena[1].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] }); // choose none

      expect(lostAbilities(unitById(g, oggdo))).toBe(false);
      expect(unitById(g, enemy).damage).toBe(2); // attack resolved
    });
  });

  describe("Epic Action — deploy as a unit or as a Pilot upgrade", () => {
    function epicSetup(resourceCount: number) {
      return new GameStateBuilder()
        .MyBase(Cards.bases.common.yellow30HP)
        .MyLeader(Cards.leaders.jtl.kazudaXiono)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resourceCount);
    }

    it("cannot deploy with fewer than 4 resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(epicSetup(3).Build());

      await g.deployLeaderAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.deployed).toBe(false);
    });

    it("deploys as a unit with 4+ resources and no eligible Vehicle", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(epicSetup(4).Build());

      await g.deployLeaderAsync(1);

      expect(g.state.player1.leader.deployed).toBe(true);
      expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.jtl.kazudaXiono)).toBe(true);
    });

    it("offers the unit-or-pilot choice when a friendly Vehicle without a Pilot is in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        epicSetup(4).WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker).Build(),
      );

      await g.deployLeaderAsync(1);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    });
  });

  describe("as a Pilot upgrade — grants its On Attack to the attached Vehicle", () => {
    it("the piloted Vehicle can silence friendly units on attack", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.yellow30HP)
        .MyLeader(Cards.leaders.jtl.kazudaXiono, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.leaders.jtl.kazudaXiono, 1), // Kazuda piloting
        ])
        .WithGroundUnitForPlayer(1, Cards.units.lof.oggdoBogdo)
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce)
        .Build();
      g.loadNewState(state);

      const oggdo = state.player1.groundArena[1].playId;
      const enemy = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0); // the Walker, piloted by Kazuda
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [oggdo] });

      expect(lostAbilities(unitById(g, oggdo))).toBe(true);
    });
  });
});
