import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_049 Shin Hati — Going Somewhere? Cost 5, 6/6 Ground Force, unique.
//   "While this is the only friendly non-leader ground unit, she gains Sentinel."
//
// Three ways to break the condition, each its own case: a second friendly ground unit, and the two
// that must NOT break it — a friendly SPACE unit, and a friendly deployed LEADER on the ground.

const SHIN = Cards.units.ash.shinHatiGoingSomewhere;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground
const XWING = Cards.units.sor.wingLeader;              // Space

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(2)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14);
}

/** Whether player 2's attacker is FORCED onto a Sentinel — the observable effect of the keyword. */
async function offeredTargets(g: GameTestAdapter): Promise<string[]> {
  await g.attackWithGroundUnitAsync(2, 0);
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
}

describe("ASH_049 Shin Hati — Going Somewhere?", () => {
  it("gains Sentinel while she is the only friendly non-leader ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, SHIN)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    const targets = await offeredTargets(g);
    const shin = g.state.player1.groundArena.find(u => u.cardId === SHIN)!;
    expect(targets).toEqual([shin.playId]);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromZones?: string[] };
    expect(res.fromZones ?? []).not.toContain("Base"); // Sentinel also blocks the base
  });

  it("loses Sentinel once a SECOND friendly non-leader ground unit is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, SHIN)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    const res = (await offeredTargets(g), g.lastDispatchResponse?.resolutionNeeded as { fromZones?: string[] });
    expect(res.fromZones ?? []).toContain("Base"); // no Sentinel: the base is a legal target again
  });

  it("a friendly SPACE unit does not break the condition — it says GROUND", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, SHIN)
        .WithSpaceUnitForPlayer(1, XWING)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    const shin = g.state.player1.groundArena.find(u => u.cardId === SHIN)!;
    expect(await offeredTargets(g)).toEqual([shin.playId]);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromZones?: string[] };
    expect(res.fromZones ?? []).not.toContain("Base");
  });

  it("a friendly deployed LEADER on the ground does not break it — it says NON-LEADER", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, SHIN)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );
    // Deploy player 1's leader onto the ground, then hand the turn back to player 2.
    g.state.activePlayer = 1;
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(1, "pass-action", {});
    // Guard the fixture: a deploy that silently failed would make this test prove nothing.
    expect(g.state.player1.groundArena).toHaveLength(2);

    const shin = g.state.player1.groundArena.find(u => u.cardId === SHIN)!;
    const targets = await offeredTargets(g);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromZones?: string[] };
    expect(res.fromZones ?? []).not.toContain("Base");
    expect(targets).toContain(shin.playId);
  });
});
