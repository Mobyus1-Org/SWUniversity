import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_108 Enforced Loyalty (Event, cost 2, Villainy) —
//   "Defeat a friendly unit. If you do, draw 2 cards."
//
// "If you do" makes the draw conditional on the defeat actually happening, so with no friendly
// unit the whole card does nothing — it must not draw 2 for free.
//
// The two cards are drawn as ONE event: from an empty deck that is a single instance of 6 damage,
// not two of 3.

const LOYALTY = "SHD_108";
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, LOYALTY)
    .WithActivePlayer(1);
  for (let i = 0; i < 4; i++) b = b.WithCardInDeckForPlayer(1, MARINE);
  return b;
}

describe("SHD_108 Enforced Loyalty", () => {
  it("defeats the chosen friendly unit and draws 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 2); // played the event, drew 2
    expect(g.state.player1.discard.some(c => c.cardId === MARINE)).toBe(true);
  });

  it("does not offer an ENEMY unit — 'a friendly unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    expect(offered).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("draws nothing when there is no friendly unit to defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(handBefore - 1); // only the event left the hand
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
