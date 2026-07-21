import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_261 Attack Run (1-cost Event, Tactic)
// "Attack with 2 space units (one at a time)."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.jtl.attackRun);
}

describe("JTL_261 Attack Run", () => {
  it("attacks with two space units, one at a time", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // 3/4
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // 3/4
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // play Attack Run
    await g.chooseSpaceUnitAsync(1, 0); // first attacker
    await g.chooseBaseAsync(1, 2); // hit enemy base
    await g.chooseSpaceUnitAsync(1, 1); // second attacker
    await g.chooseBaseAsync(1, 2); // hit enemy base

    expect(g.state.player2.base.damage).toBe(6); // 3 + 3
    // Both attackers are exhausted after attacking.
    expect(g.state.player1.spaceArena.every(u => !u.ready)).toBe(true);
  });

  it("only one space unit available — the second attack drops cleanly", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    // No second ready space unit — these are no-ops.
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("ground units are not eligible — only space units attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // 3/4 space
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // ground — ineligible
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // only the space unit hit
    expect(g.state.player1.groundArena[0].ready).toBe(true); // ground unit never attacked
  });

  it("no space unit in play — soft pass, event fizzles", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
