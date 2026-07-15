import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_005 Morgan Elsbeth — Following the Call (Ground leader)
// Leader:   "Action [Exhaust]: Choose a friendly unit that attacked this phase. Play a unit from your
//            hand that shares a keyword with the chosen unit. It costs 1 resource less."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "On Attack: The next unit you play this phase costs 1 resource less if it shares a
//            keyword with a friendly unit."
//
// Snowspeeder SOR_244 has Ambush. Blue Leader JTL_096 (cost 3, Command/Heroism) has Ambush → shares.
// Battlefield Marine SOR_095 has no keyword → never shares.

const AMBUSH_ATTACKER = Cards.units.sor.snowspeeder; // Ground, Ambush
const AMBUSH_HAND = Cards.units.jtl.blueLeader;      // Ambush, cost 3 (5 with the Heroism penalty)
const NO_KEYWORD = Cards.units.sor.battlefieldMarine; // no keyword

function frontSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.lof.morganElsbeth)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithInitiativePlayerBeing(2)
    .WithInitiativeClaimed();
}

describe("LOF_005 Morgan Elsbeth (leader) — Action: play a keyword-sharing unit at −1", () => {
  it("plays a hand unit that shares a keyword with a friendly attacker at −1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontSetup()
        .WithGroundUnitForPlayer(1, AMBUSH_ATTACKER) // Ambush
        .WithCardInHandForPlayer(1, AMBUSH_HAND)     // [0] shares Ambush
        .WithCardInHandForPlayer(1, NO_KEYWORD)      // [1] shares nothing
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // Snowspeeder attacks → "attacked this phase"
    await g.chooseBaseAsync(1, 2);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);        // choose the attacked Snowspeeder
    await g.chooseCardFromHandAsync(1, 0);      // play Blue Leader (shares Ambush)

    expect(g.state.player1.spaceArena.some(u => u.cardId === AMBUSH_HAND)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(10); // 14 − (5 − 1)
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is unavailable when no hand unit shares a keyword with an attacker", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontSetup()
        .WithGroundUnitForPlayer(1, AMBUSH_ATTACKER)
        .WithCardInHandForPlayer(1, NO_KEYWORD) // shares nothing
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("is unavailable when no friendly unit attacked this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontSetup()
        .WithGroundUnitForPlayer(1, AMBUSH_ATTACKER) // present but never attacked
        .WithCardInHandForPlayer(1, AMBUSH_HAND)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("LOF_005 Morgan Elsbeth — Epic Action deploy (5+ resources)", () => {
  it("deploys for free with 5 resources; not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.morganElsbeth)
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
        .MyLeader(Cards.leaders.lof.morganElsbeth)
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

describe("LOF_005 Morgan Elsbeth (deployed) — On Attack: next keyword-sharing unit costs 1 less", () => {
  function deployedSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.morganElsbeth, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.lof.morganElsbeth) // [0] deployed leader unit
      .WithGroundUnitForPlayer(1, AMBUSH_ATTACKER)                 // [1] friendly Ambush unit
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed();
  }

  it("gives −1 to the next unit that shares a keyword with a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().WithCardInHandForPlayer(1, AMBUSH_HAND).Build());

    await g.attackWithGroundUnitAsync(1, 0); // Morgan attacks → sets the discount
    await g.chooseBaseAsync(1, 2);
    await g.playCardFromHandAsync(1, 0);     // Blue Leader shares Ambush with Snowspeeder

    expect(g.state.player1.spaceArena.some(u => u.cardId === AMBUSH_HAND)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(10); // 14 − (5 − 1)
  });

  it("no discount for a unit that shares no keyword (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().WithCardInHandForPlayer(1, NO_KEYWORD).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.playCardFromHandAsync(1, 0); // Battlefield Marine — no keyword

    // Marine cost 2 + 2 (Heroism uncovered by Morgan's Command/Villainy) = 4, paid in full — no −1.
    // (A wrongly-applied discount would have paid 3, leaving 11 ready.)
    expect(g.state.player1.spaceArena.some(u => u.cardId === NO_KEYWORD)).toBe(false);
    expect(g.state.player1.groundArena.some(u => u.cardId === NO_KEYWORD)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(10); // 14 − 4, no discount
  });
});
