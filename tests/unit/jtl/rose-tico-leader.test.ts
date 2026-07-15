import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_004 Rose Tico — Saving What We Love (Ground leader, 4/6 when deployed)
// Leader:   "Action [Exhaust]: Heal 2 damage from a Vehicle unit that attacked this phase."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "On Attack: You may heal 2 damage from a Vehicle unit."
//
// System Patrol Craft SOR_066 = Space Vehicle 3/4. Snowspeeder SOR_244 = Ground Vehicle 3/6.
// Battlefield Marine SOR_095 = 3/3 (a non-Vehicle control).

const VEHICLE = Cards.units.sor.snowspeeder; // Ground Vehicle 3/6

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.jtl.roseTico)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithInitiativePlayerBeing(2)
    .WithInitiativeClaimed(); // player 2 auto-passes so player 1 can attack then use the Action
}

describe("JTL_004 Rose Tico (leader) — Action: heal 2 from a Vehicle that attacked this phase", () => {
  it("heals 2 damage from a Vehicle that attacked this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, VEHICLE, true, 4) // 4 damage, 6 HP → 2 remaining
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // Vehicle attacks the enemy base → "attacked this phase"
    await g.chooseBaseAsync(1, 2);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(2); // healed 4 → 2
    expect(g.state.player1.leader.ready).toBe(false);       // exhausted to pay the Action
  });

  it("is unavailable when no Vehicle attacked this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, VEHICLE, true, 4) // present, but never attacked
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[0].damage).toBe(4); // not healed
    expect(g.state.player1.leader.ready).toBe(true);        // ability never fired
  });

  it("does not offer a non-Vehicle unit that attacked this phase (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // non-Vehicle, damaged
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // the Marine attacks
    await g.chooseBaseAsync(1, 2);

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[0].damage).toBe(2); // not healed
  });
});

describe("JTL_004 Rose Tico (leader) — Epic Action deploy (5+ resources)", () => {
  it("deploys for free with 5 resources; not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(baseSetup().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5).Build());
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(true);

    const g4 = new GameTestAdapter();
    g4.loadNewState(baseSetup().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4).Build());
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(false);
  });
});

describe("JTL_004 Rose Tico (deployed) — On Attack: may heal 2 from a Vehicle unit", () => {
  function deployedSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.jtl.roseTico, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.jtl.roseTico) // [0] deployed leader unit
      .WithGroundUnitForPlayer(1, VEHICLE, true, 4)           // [1] damaged Vehicle 4/6 → 2 remaining
      .WithActivePlayer(1);
  }

  it("heals 2 from a chosen Vehicle on attack (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0); // Rose attacks
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1); // the damaged Vehicle

    expect(g.state.player1.groundArena[1].damage).toBe(2); // healed 4 → 2
  });

  it("declines — no healing (decline)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[1].damage).toBe(4); // untouched
  });
});
