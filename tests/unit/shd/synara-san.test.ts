import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasGrit } from "@/server/engine/card-db/keyword-dictionaries.ts/grit";

// SHD_033 Synara San — Loyal to Kragan (3/6 Ground, cost 4, Villainy/Vigilance)
//   "Grit"
//   "While this unit is exhausted, she gains, 'Bounty — Deal 5 damage to a base.'"
//
// The Bounty exists only while she is exhausted: defeated while ready, she pays nothing.

const SYNARA = Cards.units.shd.synaraSan;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup(synaraReady: boolean) {
  // Synara (3/6) carries 5 damage; the enemy Marine attacks her and finishes her off.
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.idenVersio)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, SYNARA, synaraReady, 5)
    .WithActivePlayer(1);
}

describe("SHD_033 Synara San", () => {
  it("has Grit", () => {
    expect(HasGrit(SYNARA)).toBe(true);
  });

  it("defeated while exhausted: her opponent collects 5 damage to a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player2.groundArena.length).toBe(0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

    expect(g.state.player2.base.damage).toBe(5);
  });

  it("defeated while ready: no Bounty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(true).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
