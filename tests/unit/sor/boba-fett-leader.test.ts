import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_015 Boba Fett — Collecting the Bounty
// Leader:   "When an enemy unit leaves play: You may exhaust this leader. If you do, ready a resource."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "When this unit completes an attack: If an enemy unit left play this phase, ready up to
//            2 resources."

function readyCount(resources: { ready: boolean }[]): number {
  return resources.filter(r => r.ready).length;
}

describe("SOR_015 Boba Fett — leader reaction (enemy leaves play → may exhaust to ready a resource)", () => {
  function setup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalDodonna)     // 4/4 attacker (no On Attack)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // enemy 3/3, dies to Dodonna
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3, false) // 3 exhausted resources
      .WithActivePlayer(1);
  }

  it("exhausts Boba to ready a resource when an enemy unit is defeated (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);   // Dodonna attacks
    await g.chooseGroundUnitAsync(2, 0);       // ...the enemy marine → defeats it
    await g.chooseYesAsync(1);                  // exhaust Boba to ready a resource

    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyCount(g.state.player1.resources)).toBe(1);
  });

  it("may decline — Boba stays ready, no resource readied", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(readyCount(g.state.player1.resources)).toBe(0);
  });

  it("does not prompt when there is no exhausted resource to ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.bobaFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.generalDodonna)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3, true) // all ready
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("SOR_015 Boba Fett — Epic Action deploy (5+ resources)", () => {
  it("deploys for free with 5 resources; not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.bobaFett)
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
        .MyLeader(Cards.leaders.sor.bobaFett)
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

describe("SOR_015 Boba Fett — deployed: complete an attack → ready up to 2 resources", () => {
  it("readies up to 2 resources when an enemy unit left play this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.bobaFett, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.bobaFett)         // deployed Boba 4/7
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // enemy 3/3, dies
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3, false) // 3 exhausted
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // Boba attacks
    await g.chooseGroundUnitAsync(2, 0);     // ...the enemy marine → defeats it

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(readyCount(g.state.player1.resources)).toBe(2); // up to 2 readied
  });

  it("readies nothing when no enemy unit left play this phase (attacks the base)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.bobaFett, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.bobaFett)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3, false)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attack the enemy base — no enemy unit leaves play

    expect(readyCount(g.state.player1.resources)).toBe(0);
  });
});
