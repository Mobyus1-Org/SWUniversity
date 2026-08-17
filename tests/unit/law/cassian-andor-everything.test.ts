import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_056 Cassian Andor — Everything For the Rebellion (4/4 Ground, Rebel, cost 4)
//   "When a friendly unit's attack ends: If the defending unit was defeated, deal 2 damage to a base."
//
// A watcher, not a self-trigger: it fires on ANY friendly unit's attack, including Cassian's own,
// and only when the DEFENDING UNIT was defeated (a base attack never qualifies).

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithGroundUnitForPlayer(1, Cards.units.law.cassianAndorLaw);
}

describe("LAW_056 Cassian Andor — When a friendly unit's attack ends", () => {
  it("another friendly unit defeating its defender deals 2 to the chosen base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3 power
        .WithGroundUnitForPlayer(2, Cards.units.law.honorBoundPartisan)    // 2/2 — dies
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 1); // the Consular Security Force attacks
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 2);           // Cassian's 2 damage

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("fires on CASSIAN'S OWN attack too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.law.honorBoundPartisan).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("does NOT fire when the defender survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives 4
        .Build(),
    );

    const attacked = await g.attackWithGroundUnitAsync(1, 0);
    const afterTarget = await g.chooseGroundUnitAsync(2, 0);

    expect(attacked.lastDispatchResponse).toBeDefined();
    expect(afterTarget.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("does NOT fire on a base attack — there is no defending unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    const afterTarget = await g.chooseBaseAsync(1, 2);

    expect(afterTarget.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(4); // combat damage only
  });

  it("does NOT fire for the OPPONENT's attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.honorBoundPartisan)    // 2/2 — the victim
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 1); // kills the friendly Partisan
    // The Partisan's own When Defeated has no prompt, so nothing further should be asked of P1.

    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("'a base' means either — Cassian's controller may hit their own", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.law.honorBoundPartisan).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(2);
  });

  it("control: without Cassian in play the same kill deals nothing extra", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.law.honorBoundPartisan)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
