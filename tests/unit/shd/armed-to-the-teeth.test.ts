import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_175 Armed to the Teeth (Upgrade, +2/+0) — 'Attached unit gains: "On Attack: Give another
// friendly unit +2/+0 for this phase."'  Smuggle [4 Aggression].
//
// The Smuggle cost was already registered in smuggle.ts; the granted On Attack was not. Note
// "another friendly unit" — the attached unit itself is not a legal target.

const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground
const CSF = Cards.units.sor.consularSecurityForce;     // 3/7 Ground, no abilities

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [
      { cardId: Cards.upgrades.shd.armedToTheTeeth, playId: "@", owner: 1, controller: 1 },
    ])
    .WithGroundUnitForPlayer(1, CSF);
}

describe("SHD_175 Armed to the Teeth", () => {
  it("gives another friendly unit +2/+0 when the attached unit attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 1); // buff the Consular Security Force

    // The buffed unit attacks for 3 + 2 = 5.
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    // 3 (attacker, +2 from the upgrade's own stats) + 5 (buffed CSF) = 10
    expect(g.state.player2.base.damage).toBe(10);
  });

  it("cannot buff the attached unit itself ('another')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    await g.chooseGroundUnitAsync(1, 0); // the attacker carrying the upgrade
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);

    await g.chooseGroundUnitAsync(1, 1);
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });

  it("does not fire for a unit without the upgrade (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 1); // the un-upgraded Consular Security Force
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("adds its own +2/+0 to the attached unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 1);

    expect(g.state.player2.base.damage).toBe(5); // 3 printed + 2 from the upgrade
  });

  it("the buff lasts the phase, not just the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 1);
    const afterFirst = g.state.player2.base.damage;

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage - afterFirst).toBe(5); // still buffed
  });
});
