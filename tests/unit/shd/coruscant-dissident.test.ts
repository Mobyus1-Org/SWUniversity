import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_199 Coruscant Dissident (3/4 Ground, cost 3, Underworld) —
//   "On Attack: You may ready a resource."
//
// Optional, and pointless with nothing exhausted — so with every resource already ready there
// should be no prompt at all rather than an offer that does nothing.

const DISSIDENT = "SHD_199";
const MARINE = Cards.units.sor.battlefieldMarine;

function setup(resources: number, ready: boolean) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources, ready)
    .WithGroundUnitForPlayer(1, DISSIDENT)
    .WithActivePlayer(1);
}

const readyCount = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("SHD_199 Coruscant Dissident", () => {
  it("readies one exhausted resource on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(readyCount(g)).toBe(1);
  });

  it("readies exactly one, not all of them", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(readyCount(g)).toBe(1);
    expect(g.state.player1.resources.filter(r => !r.ready)).toHaveLength(3);
  });

  it("is optional — declining readies nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(readyCount(g)).toBe(0);
  });

  it("does not ask when nothing is exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, true).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(readyCount(g)).toBe(4);
  });

  it("the attack still lands either way", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(3);
  });
});
