import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_014 Grand Inquisitor — Stories Travel Quickly (Ground leader, 3/5 deployed, Shielded)
// Leader:   "Action [Exhaust, use the Force (lose your Force token)]: Attack with a friendly unit.
//            The defender gets –2/–0 for this attack."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "Shielded" + "On Attack: The defender gets –2/–0 for this attack."
//
// Reinforcement Walker SOR_119 = 6/9. Gamorrean Guards SOR_211 = 4/4.

const WALKER = Cards.units.sor.reinforcementWalker; // 6/9
const DEFENDER = Cards.units.sor.gamorreanGuards;   // 4/4

describe("LOF_014 Grand Inquisitor (leader) — Action: attack, defender −2/−0", () => {
  it("attacks with a friendly unit and the defender deals 2 less counter-damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.grandInquisitor)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, WALKER)   // friendly attacker
      .WithGroundUnitForPlayer(2, DEFENDER) // enemy defender (4 power)
      .WithActivePlayer(1)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // attack with the Walker
    await g.chooseGroundUnitAsync(2, 0); // defender = Gamorrean

    // Gamorrean's 4 power is reduced to 2, so the Walker takes only 2 counter-damage.
    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena.length).toBe(0); // Gamorrean defeated by 6 power
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("is unavailable without the Force", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.grandInquisitor)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, WALKER)
        .WithActivePlayer(1)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("LOF_014 Grand Inquisitor — Epic Action deploy (5+) grants a Shield", () => {
  it("deploys with 5 resources and gains a Shield token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.grandInquisitor)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g.deployLeaderAsync(1);
    expect(g.state.player1.leader.deployed).toBe(true);
    const gi = g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.lof.grandInquisitor)!;
    expect(gi.upgrades.some(u => u.cardId === "SOR_T02")).toBe(true); // Shield token

    const g4 = new GameTestAdapter();
    g4.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.grandInquisitor)
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

describe("LOF_014 Grand Inquisitor (deployed) — On Attack: defender −2/−0", () => {
  it("the defender deals 2 less counter-damage to the Inquisitor", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.grandInquisitor, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.lof.grandInquisitor) // [0] deployed leader unit (3/5)
        .WithGroundUnitForPlayer(2, DEFENDER)                          // 4-power defender
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the Gamorrean

    // Gamorrean's 4 power reduced to 2 → the Inquisitor (no Shield in this fixture) takes 2 counter.
    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(3); // Inquisitor's 3 power to the Gamorrean
  });
});
