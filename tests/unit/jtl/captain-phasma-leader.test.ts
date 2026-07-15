import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_010 Captain Phasma — Chrome Dome (Ground leader)
// Leader:   "Action [Exhaust]: If you played a First Order card this phase, deal 1 damage to a base."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "On Attack: If you played another First Order card this phase, you may deal 1 damage to
//            a unit. If you do, deal 1 damage to a base."
//
// Kijimi Patrollers JTL_082 = First Order Vehicle Fighter, cost 2 (a card to "play this phase").

const FIRST_ORDER = Cards.units.jtl.kijimiPatrollers;

function frontSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.jtl.captainPhasma)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithCardInHandForPlayer(1, FIRST_ORDER)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithInitiativePlayerBeing(2)
    .WithInitiativeClaimed(); // player 2 auto-passes → player 1 plays then uses the Action
}

describe("JTL_010 Captain Phasma (leader) — Action: 1 damage to a base after a First Order card", () => {
  it("deals 1 to a chosen base once a First Order card was played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup().Build());

    await g.playCardFromHandAsync(1, 0); // play First Order Kijimi Patrollers
    await g.useLeaderAbilityAsync(1);
    await g.chooseBaseAsync(1, 2); // deal 1 to the opponent's base

    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("soft-passes when no First Order card was played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup().Build());

    const used = await g.useLeaderAbilityAsync(1); // no First Order played yet

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false); // exhausted, but soft-passed
  });
});

describe("JTL_010 Captain Phasma — Epic Action deploy (5+ resources)", () => {
  it("deploys for free with 5 resources; not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.captainPhasma)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(true);

    const g4 = new GameTestAdapter();
    g4.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.captainPhasma)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithActivePlayer(1)
        .Build(),
    );
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(false);
  });
});

describe("JTL_010 Captain Phasma (deployed) — On Attack: 1 to a unit, then 1 to a base", () => {
  function deployedSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.jtl.captainPhasma, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.jtl.captainPhasma) // [0] deployed leader unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // enemy unit to hit
      .WithCardInHandForPlayer(1, FIRST_ORDER)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed();
  }

  it("deals 1 to a unit and 1 to a base when a First Order card was played (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    await g.playCardFromHandAsync(1, 0);      // First Order card played this phase
    await g.attackWithGroundUnitAsync(1, 0);  // Phasma attacks
    await g.chooseBaseAsync(1, 2);            // attack the enemy base
    await g.chooseYesAsync(1);                // "may deal 1 to a unit" — yes
    await g.chooseGroundUnitAsync(2, 0);      // the enemy Gamorrean Guards
    await g.chooseBaseAsync(1, 2);            // "if you do, deal 1 to a base"

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    // Enemy base took the attack (Phasma's 4 power) + 1 from the ability.
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("declines the unit damage → no base damage from the ability (decline)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1); // skip the ability

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4); // only Phasma's combat damage
  });

  it("no On-Attack trigger without a First Order card this phase (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    // Do NOT play a First Order card; just attack.
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });
});
