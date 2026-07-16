import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_004 Grand Admiral Thrawn (Leader, cost 8)
// Leader:   "Action [Exhaust]: Attack with a unit. It gains Restore 2 for this attack if you
//            control the same number of units as the defending player.
//            Epic Action: If you control 8 or more resources, deploy this leader."
// Deployed side (ASH_033) is covered separately in grand-admiral-thrawn.test.ts.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5) // 5 damage, so Restore has something to heal
    .MyLeader(Cards.leaders.ash.grandAdmiralThrawn)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_004 Grand Admiral Thrawn — Leader ability", () => {
  it("attacks with a chosen unit, which gains Restore 2 when unit counts are equal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 1 unit for P1
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 1 unit for P2 — equal count
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // attack with the Marine
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(3); // 5 - 2 restored
    expect(g.state.player1.leader.ready).toBe(false); // exhausted
  });

  it("does not grant Restore when unit counts are unequal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // 2 units for P1
        .Build(),
        // P2 has 0 units — counts unequal
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(5); // no Restore — unchanged
  });

  it("Epic Action: cannot deploy with fewer than 8 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.ash.grandAdmiralThrawn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
        .Build(),
    );

    const result = await g.deployLeaderAsync(1);
    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.leader.deployed).toBe(false);
  });

  it("Epic Action: deploys for free with 8 or more resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.ash.grandAdmiralThrawn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .Build(),
    );

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(8); // no resources spent
  });
});
