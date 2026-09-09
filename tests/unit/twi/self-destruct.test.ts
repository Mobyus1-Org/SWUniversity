import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// TWI_140 Self-Destruct. Cost 2 Aggression/Villainy Tactic event.
//   "Defeat a friendly unit. If you do, deal 4 damage to a unit."
//
// The defeat is a prerequisite, not a bonus: with no friendly unit to defeat, the "if you do"
// damage never happens. The 4 damage is then unrestricted — any unit, your own included.

const SELF_DESTRUCT = Cards.events.twi.selfDestruct;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, SELF_DESTRUCT);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
};
const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.find(u => u.cardId === cardId);

describe("TWI_140 Self-Destruct", () => {
  it("defeats the chosen friendly unit, then deals 4 to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY)!.playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.some(c => c.cardId === MARINE)).toBe(true);
    expect(find(g, 2, SECURITY)!.damage).toBe(4);
  });

  it("only offers FRIENDLY units for the defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)).toEqual([find(g, 1, MARINE)!.playId]);
  });

  it("does nothing at all with no friendly unit to defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(find(g, 2, SECURITY)!.damage).toBe(0);
  });

  it("can aim the 4 damage at another unit you control", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, SECURITY).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, SECURITY)!.playId] });

    expect(find(g, 1, SECURITY)!.damage).toBe(4);
  });

  it("still deals the 4 when the defeated unit was the only other one", async () => {
    // The damage step is offered after the defeat, so the pool must be recomputed — the defeated
    // unit is gone and must not be offered.
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });

    expect(offered(g)).toEqual([find(g, 2, SECURITY)!.playId]);
  });
});
