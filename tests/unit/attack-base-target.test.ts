import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "./game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../card-helpers";

// Regression: attacking a base must offer ONLY the enemy base as a target, while ability
// "a base" targets (Daring Raid, Itinerant Warrior, …) may offer either base.

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("attack base targeting", () => {
  it("attacking a base restricts the base target to the enemy only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    const r = await g.attackWithGroundUnitAsync(1, 0);
    const res = r.lastDispatchResponse?.resolutionNeeded;

    expect(res?.type).toBe("Target");
    if (res?.type !== "Target") throw new Error("expected a Target resolution");
    expect(res.fromZones).toContain("Base");
    // A unit can only attack the ENEMY base — never its own.
    expect(res.baseTargetPlayers).toEqual([2]);
  });

  it("an ability 'a base' target does not restrict to one base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid) // "Deal 2 damage to a unit or base."
        .Build(),
    );

    const r = await g.playCardFromHandAsync(1, 0);
    const res = r.lastDispatchResponse?.resolutionNeeded;

    // Either base is legal for "a base", so no enemy-only restriction is set.
    expect(res?.type).toBe("Target");
    if (res?.type !== "Target") throw new Error("expected a Target resolution");
    expect(res.baseTargetPlayers).toBeUndefined();
  });
});
