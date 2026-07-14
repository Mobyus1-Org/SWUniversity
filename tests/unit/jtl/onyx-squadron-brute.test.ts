import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_033 Onyx Squadron Brute (2/3 Space, cost 2)
// "When Defeated: Heal 2 damage from a base."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP, 5)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // Brute (2/3) attacks System Patrol Craft (3/4) — the Brute takes 3 and dies.
    .WithSpaceUnitForPlayer(1, Cards.units.jtl.onyxSquadronBrute)
    .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft);
}

describe("JTL_033 Onyx Squadron Brute — When Defeated", () => {
  it("heals 2 damage from your own base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(3); // 5 - 2
    expect(g.state.player2.base.damage).toBe(5); // untouched
  });

  it("can heal the opponent's base ('a base' — either one)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // 5 - 2
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("prompts for a base when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    const afterTrade = await g.chooseSpaceUnitAsync(2, 0);

    // The Brute died, so the heal target prompt must be live.
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(afterTrade.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });
});
