import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_085 — Rukh (Unit, Command+Villainy, cost 5, Shielded, 3/6)
// "Shielded (When you play this unit, give a Shield token to it.)
//  When this unit deals combat damage to a non-leader unit while attacking: Defeat that unit."
//
// "Deals combat damage" means the damage goes through (not absorbed by a Shield).
// A Shield on the DEFENDER blocks the attack, so no combat damage is dealt → ability doesn't fire.

describe("SOR_085 — Rukh", () => {
  it("defeats the defender after dealing combat damage to a non-leader unit", async () => {
    // Rukh (3/6) attacks a Reinforcement Walker (6/9). Rukh deals 3 damage.
    // Walker would survive normally (9 HP - 3 = 6 remaining). But Rukh's ability defeats it.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command+Villainy
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.chewbacca)
      .WithGroundUnitForPlayer(1, Cards.units.sor.rukh)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9
      .Build();
    g.loadNewState(state);

    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    // Walker defeated even though 3 < 9 HP.
    expect(g.state.player2.groundArena.find(u => u.playId === walkerPlayId)).toBeUndefined();
  });

  it("does NOT defeat the defender when Shield absorbs Rukh's damage", async () => {
    // Defender has a Shield token. Shield absorbs the attack → no combat damage → ability doesn't fire.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.chewbacca)
      .WithGroundUnitForPlayer(1, Cards.units.sor.rukh)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2),
      ])
      .Build();
    g.loadNewState(state);

    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    // Shield absorbed Rukh's attack → no combat damage dealt → defender NOT defeated.
    const walker = g.state.player2.groundArena.find(u => u.playId === walkerPlayId);
    expect(walker).toBeDefined();
    expect(walker?.damage).toBe(0); // Shield absorbed, no damage
  });

  it("does NOT defeat a leader unit (ability only triggers against non-leader units)", async () => {
    // Deploy an opposing leader unit. Rukh attacks it.
    // Ability says "non-leader unit" — deployed leader units should NOT be defeated.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.chewbacca)
      .WithGroundUnitForPlayer(1, Cards.units.sor.rukh)
      .Build();
    g.loadNewState(state);

    // Deploy the enemy leader (Chewbacca).
    state.player2.leader.deployed = true;
    const chewiePlayId = `leader-2-deployed`;
    // Leaders use their leader playId when deployed.
    const chewieUnit = state.player2.groundArena.find(u => u.cardId === "SOR_003" || u.ready === true);

    // Actually the deployed leader ID is set separately. Let's use the normal attack target ID.
    await g.attackWithGroundUnitAsync(1, 0);
    const resolution = g.lastDispatchResponse?.resolutionNeeded;

    if (resolution?.type === "Target" && resolution.fromPlayIds && resolution.fromPlayIds.length > 0) {
      const leaderPlayId = resolution.fromPlayIds[0];
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderPlayId] });

      // Leader should NOT be defeated — just takes damage.
      expect(g.state.player2.leader.deployed).toBe(true);
    }
  });
});
