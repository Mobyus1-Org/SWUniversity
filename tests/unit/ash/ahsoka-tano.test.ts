import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// ASH_009 Ahsoka Tano (Trust in the Force) — leader, 5/6 Ground when deployed
// Leader side: "Action [Exhaust]: Choose a unit with less power than a friendly unit. It gets
//               +2/+0 for this phase."
// Deployed:    "Support (When you deploy this leader, you may attack with another unit…)"
//              "On Attack: You may give a unit with less power than this unit +2/+0 for this phase."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.ash.ahsokaTano)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10);
}

describe("ASH_009 Ahsoka Tano (Trust in the Force)", () => {
  it("leader Action: gives a weaker unit +2/+0 for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards) // 4 power — the yardstick
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)   // 3 power — weaker
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(5); // 3 + 2
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust cost
  });

  it("Support: deploying her lets another unit attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.deployLeaderAsync(1);
    await g.chooseYesAsync(1);           // Support
    await g.chooseGroundUnitAsync(1, 0); // the Marine attacks
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("deployed On Attack: gives a weaker unit +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.ahsokaTano, true, true) // already deployed
        .WithGroundUnitForPlayer(1, Cards.units.ash.ahsokaTano) // her 5-power leader unit
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power — weaker than 5
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(5);
  });
});
