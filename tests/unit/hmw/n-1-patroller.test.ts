import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_086 N-1 Patroller (2/2 Space, cost 3, Vigilance) —
//   "When Played: You may defeat a non-leader unit with 1 or less remaining HP."
//
// REMAINING HP (HP minus damage), either side, never a leader unit.

const N1 = Cards.units.hmw.n1Patroller;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, N1)
    .WithActivePlayer(1);
}

describe("HMW_086 N-1 Patroller", () => {
  it("defeats an enemy non-leader unit with 1 remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE, true, 2).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE, true, 2).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena.length).toBe(1);
  });

  it("asks nothing when no unit is at 1 or less remaining HP (2 remaining is out of range)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE, true, 1).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena.length).toBe(1);
  });

  it("never offers a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().FillResourcesForPlayer(2, MARINE, 14).WithActivePlayer(2).Build());
    await g.deployLeaderAsync(2);
    const leaderUnit = g.state.player2.groundArena[0];
    leaderUnit.damage = Unit.FromInterface(leaderUnit).TotalHP() - 1; // exactly 1 remaining HP

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
