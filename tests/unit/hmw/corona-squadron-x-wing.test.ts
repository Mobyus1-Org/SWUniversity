import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_209 Corona Squadron X-Wing (2/2 Space, cost 2, Cunning/Heroism) —
//   "On Attack: You may ready a resource."
// Same text as SHD_199 Coruscant Dissident. Not offered with nothing exhausted.

const XWING = Cards.units.hmw.coronaSquadronXWing;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup(resources: number, ready: boolean) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources, ready)
    .WithSpaceUnitForPlayer(1, XWING)
    .WithActivePlayer(1);
}

const readyCount = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("HMW_209 Corona Squadron X-Wing", () => {
  it("readies exactly one exhausted resource on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, false).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(readyCount(g)).toBe(1);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("is optional — declining readies nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, false).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(readyCount(g)).toBe(0);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("does not ask when nothing is exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, true).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(readyCount(g)).toBe(4);
  });
});
