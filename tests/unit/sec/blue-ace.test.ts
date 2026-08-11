import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_204 Blue Ace — Colorful Racer (4/5 Space Resistance Vehicle)
//   "Ambush
//    On Attack: Ready an exhausted enemy unit."
//
// The On Attack is MANDATORY (no "you may") and targets an ENEMY unit only — and readying an
// enemy is a drawback, so the "only exhausted enemies are eligible" restriction matters.

const MARINE = Cards.units.sor.battlefieldMarine;
const BLUE_ACE = Cards.units.sec.blueAce;
const WAYFARER = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space — survives the trade

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 16);
}

describe("SEC_204 Blue Ace", () => {
  it("readies the chosen exhausted enemy unit on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, BLUE_ACE)
        .WithGroundUnitForPlayer(2, MARINE, false) // exhausted enemy
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("does not offer a READY enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, BLUE_ACE)
        .WithGroundUnitForPlayer(2, MARINE, true) // already ready — not eligible
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("does not offer a friendly exhausted unit ('enemy')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, BLUE_ACE)
        .WithGroundUnitForPlayer(1, MARINE, false) // friendly exhausted — ineligible
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[0].ready).toBe(false); // stayed exhausted
  });

  it("has Ambush — it may attack as it enters play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(1, BLUE_ACE)
        .WithSpaceUnitForPlayer(2, WAYFARER)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });
});
