import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_037 Banshee — Crippling Command (Unit 4/5 Space, cost 5, Vigilance/Villainy)
//   "On Attack: You may deal damage to a unit equal to the amount of damage on this unit."

const BANSHEE = Cards.units.jtl.banshee;
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7

function setup(bansheeDamage: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithSpaceUnitForPlayer(1, BANSHEE, true, bansheeDamage)
    .WithGroundUnitForPlayer(2, DURABLE);
}

describe("JTL_037 Banshee", () => {
  it("deals damage equal to the damage on it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("may target itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player1.spaceArena[0].playId);
  });

  it("declining deals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("undamaged — no offer at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(0).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(4);
  });
});
