import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_007 Captain Rex — Fighting For His Brothers (2/6 Ground, Republic/Clone/Trooper)
// Leader:   "Action [2 resources, Exhaust]: If a friendly unit attacked this phase,
//            create a Clone Trooper token."
// Deployed: "When Deployed: Create a Clone Trooper token."
//           "Each other friendly Trooper unit gets +0/+1."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.twi.captainRex)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithInitiativePlayerBeing(2)
    .WithInitiativeClaimed(); // player 2 auto-passes so player 1 can act twice
}

function readyCount(resources: { ready: boolean }[]): number {
  return resources.filter(r => r.ready).length;
}

function cloneTroopers(units: { cardId: string }[]): number {
  return units.filter(u => u.cardId === Cards.units.token.cloneTrooper).length;
}

describe("TWI_007 Captain Rex — Leader ability", () => {
  it("creates a Clone Trooper token after a friendly unit attacked this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attack the enemy base
    const readyBefore = readyCount(g.state.player1.resources);

    await g.useLeaderAbilityAsync(1);

    expect(cloneTroopers(g.state.player1.groundArena)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false); // exhausted
    expect(readyCount(g.state.player1.resources)).toBe(readyBefore - 2); // 2 resources
  });

  it("soft-passes when no friendly unit attacked this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.useLeaderAbilityAsync(1);

    expect(cloneTroopers(g.state.player1.groundArena)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
  });
});

describe("TWI_007 Captain Rex — Deployed leader unit", () => {
  it("When Deployed: creates a Clone Trooper token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.captainRex)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10) // ≥5 resources to deploy
        .Build(),
    );

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(cloneTroopers(g.state.player1.groundArena)).toBe(1);
  });

  it("gives another friendly Trooper +0/+1, so it survives damage equal to its printed HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.captainRex)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Trooper, 3/3 → 3/4 with Rex
        .WithGroundUnitForPlayer(2, Cards.units.sor.deathTrooper) // 3 power attacker
        .Build(),
    );

    await g.deployLeaderAsync(1); // Rex enters: friendly Marine becomes 3/4

    // Enemy Death Trooper (3 power) attacks the Marine: 3 damage on a 4-HP unit survives.
    const marineIdx = g.state.player1.groundArena.findIndex(
      u => u.cardId === Cards.units.sor.battlefieldMarine,
    );
    const marinePlayId = g.state.player1.groundArena[marineIdx].playId;
    await g.dispatchAsync(1, "pass-action", {});
    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId);
    expect(marine).toBeDefined(); // survived: 3 damage < 4 HP
    expect(marine!.damage).toBe(3);
  });

  it("does not buff a non-Trooper friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.captainRex)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // NOT a Trooper (4 HP)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6 power attacker
        .Build(),
    );

    await g.deployLeaderAsync(1); // Rex enters — the Guards must NOT gain +0/+1

    // 4 damage into the Guards: lethal at 4 HP, and would NOT be lethal at 5.
    const guardsPlayId = g.state.player1.groundArena.find(
      u => u.cardId === Cards.units.sor.gamorreanGuards,
    )!.playId;
    await g.dispatchAsync(1, "pass-action", {});
    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [guardsPlayId] });

    expect(
      g.state.player1.groundArena.some(u => u.playId === guardsPlayId),
    ).toBe(false); // died to 4+ damage — no Rex buff applied
  });

  it("does not buff an enemy Trooper unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.captainRex)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // friendly Trooper, 3 power
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy Trooper, 3 HP
        .WithInitiativePlayerBeing(2)
        .WithInitiativeClaimed() // player 2 auto-passes, so player 1 acts again after deploying
        .Build(),
    );

    await g.deployLeaderAsync(1);

    // Friendly 3-power Trooper attacks the enemy Trooper: 3 damage kills it, because Rex's
    // +0/+1 applies only to FRIENDLY Troopers (an enemy 3/4 would have survived).
    const attackerIdx = g.state.player1.groundArena.findIndex(
      u => u.cardId === Cards.units.sor.deathTrooper,
    );
    const enemyMarinePlayId = g.state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, attackerIdx);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] });

    expect(g.state.player2.groundArena).toHaveLength(0); // enemy Trooper died at 3 HP
  });
});
