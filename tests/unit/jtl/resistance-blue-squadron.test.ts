import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_102 Resistance Blue Squadron (3/4 Space, cost 4, Resistance Vehicle Fighter)
// "When Played: You may deal damage to a unit equal to the number of friendly space units."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.jtl.resistanceBlueSquadron)
    // Gamorrean Guards (4/4) — a durable enemy target to read the exact damage off.
    .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards);
}

describe("JTL_102 Resistance Blue Squadron — When Played", () => {
  it("deals damage equal to friendly space units, counting itself", async () => {
    const g = new GameTestAdapter();
    // No other friendly space unit — after it enters, there is exactly 1 friendly space unit.
    g.loadNewState(baseSetup().Build());

    await g.playCardFromHandAsync(1, 0); // play Blue Squadron
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(2, 0); // target the Gamorrean Guards

    expect(g.state.player2.groundArena[0].damage).toBe(1); // just itself
  });

  it("scales with the number of friendly space units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // Blue Squadron → now 3 friendly space units
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3); // 2 existing + itself
  });

  it("declining deals no damage (prompt must appear)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.playCardFromHandAsync(1, 0);
    const afterPlay = await g.chooseOptionAsync(1, "No");

    // The optional prompt must actually have been live, or "No" is a silent no-op.
    expect(afterPlay.lastDispatchResponse).toBeDefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("can target a friendly unit ('a unit' — either side)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // 2 friendly space units
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseSpaceUnitAsync(1, 0); // own System Patrol Craft (4 HP)

    expect(g.state.player1.spaceArena[0].damage).toBe(2);
  });
});
