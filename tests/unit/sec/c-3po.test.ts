import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_015 C-3PO (Human-Cyborg Relations) — leader, 1/6 Ground when deployed.
// Front: "Action [1 resource, Exhaust]: If you control an exhausted unit, exhaust a unit."
// Deployed: "On Attack: If you control another exhausted unit, you may exhaust a unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sec.c3po)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10);
}

describe("SEC_015 C-3PO (Human-Cyborg Relations)", () => {
  it("leader Action: while controlling an exhausted unit, exhausts a chosen unit (and pays 1 + exhausts the leader)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false)          // an exhausted friendly unit (the condition)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)               // the target to exhaust (ready)
        .Build(),
    );
    const readyResBefore = g.state.player1.resources.filter(r => r.ready).length;

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // exhaust the enemy Honor Guards

    expect(g.state.player2.groundArena[0].ready).toBe(false);            // exhausted
    expect(g.state.player1.leader.ready).toBe(false);                   // leader exhausted (cost)
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyResBefore - 1); // paid 1
  });

  it("leader Action soft-passes when you control no exhausted unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // ready (not exhausted)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .Build(),
    );

    const res = await g.useLeaderAbilityAsync(1);

    // No exhausted unit controlled → the action resolves to nothing (no target prompt).
    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].ready).toBe(true); // nothing exhausted
    expect(g.state.player1.leader.ready).toBe(false);        // still paid the cost (soft pass)
  });

  it("deployed On Attack: with another exhausted unit, may exhaust a chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sec.c3po, true, true) // deployed
        .WithGroundUnitForPlayer(1, Cards.leaders.sec.c3po)                     // the leader unit (attacker)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false) // another exhausted unit (condition)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)      // the target to exhaust
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // C-3PO attacks
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);     // exhaust the enemy unit

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("deployed On Attack: no prompt without another exhausted unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sec.c3po, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.sec.c3po)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // ready, not exhausted
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseBaseAsync(1, 2);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
