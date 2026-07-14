import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";

// LOF_091 Craving Power — Upgrade (Command/Villainy, Innate), cost 5, +2/+2
// "Attach to a friendly unit."
// "When Played: Deal damage to an enemy unit equal to attached unit's power."
//
// The upgrade is attached before the When Played resolves, so its own +2 power counts
// toward the damage dealt.

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.upgrades.lof.cravingPower);
}

describe("LOF_091 Craving Power", () => {
  describe("attach restriction — 'Attach to a friendly unit.'", () => {
    it("offers only friendly units as attach targets", async () => {
      const g = new GameTestAdapter();
      const state = setup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const friendlyPlayId = state.player1.groundArena[0].playId;
      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);

      const targets = TargetIds(g);
      expect(targets).toContain(friendlyPlayId);
      expect(targets).not.toContain(enemyPlayId);
    });
  });

  describe("'When Played: Deal damage to an enemy unit equal to attached unit's power.'", () => {
    it("deals damage equal to the attached unit's power, including its own +2", async () => {
      const g = new GameTestAdapter();
      const state = setup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce) // 6/8, survives
        .Build();
      g.loadNewState(state);

      const hostPlayId = state.player1.groundArena[0].playId;
      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [hostPlayId] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      // Battlefield Marine 3 power + Craving Power's +2 = 5
      expect(g.state.player2.groundArena[0].damage).toBe(5);
    });

    it("counts buffs on the attached unit (Experience token) in the damage", async () => {
      const g = new GameTestAdapter();
      const state = setup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
        ])
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce)
        .Build();
      g.loadNewState(state);

      const hostPlayId = state.player1.groundArena[0].playId;
      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [hostPlayId] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      // 3 (base) + 1 (Experience) + 2 (Craving Power) = 6
      expect(g.state.player2.groundArena[0].damage).toBe(6);
    });

    it("targets only ENEMY units", async () => {
      const g = new GameTestAdapter();
      const state = setup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce)
        .Build();
      g.loadNewState(state);

      const hostPlayId = state.player1.groundArena[0].playId;
      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [hostPlayId] });

      const targets = TargetIds(g);
      expect(targets).toEqual([enemyPlayId]);
      expect(targets).not.toContain(hostPlayId);
    });

    it("can defeat the enemy unit outright", async () => {
      const g = new GameTestAdapter();
      const state = setup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — dies to 5
        .Build();
      g.loadNewState(state);

      const hostPlayId = state.player1.groundArena[0].playId;
      const enemyPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [hostPlayId] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      expect(g.state.player2.groundArena).toHaveLength(0);
    });

    it("attaches with no prompt when there are no enemy units", async () => {
      const g = new GameTestAdapter();
      const state = setup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const hostPlayId = state.player1.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [hostPlayId] });

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      expect(g.state.player1.groundArena[0].upgrades).toHaveLength(1);
    });
  });
});
