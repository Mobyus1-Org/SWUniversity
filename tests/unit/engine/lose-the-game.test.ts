import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { MarkPlayerLost } from "@/server/engine/core-functions";

// Engine mechanic: a player can lose for a reason other than base damage.
//
// updateDefeatedPlayers REBUILDS defeatedPlayers from base HP on every call, and it is called at
// the exit of every dispatch — so a naive "push the player into defeatedPlayers" is erased by the
// next action. The loss has to be recorded somewhere durable and re-applied on each rebuild.
//
// Carried as a Permanent currentEffect rather than a new GameState field on purpose: currentEffects
// already round-trips through the puzzle hydrator, the builder and StaticBoard, so this needs no
// changes to those three hand-written mirrors and cannot silently vanish in a puzzle.
//
// Blocks SHD_208 Final Showdown ("At the start of the regroup phase, you lose the game").

const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithActivePlayer(1);
}

describe("losing the game outright", () => {
  it("marks the player defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    MarkPlayerLost(g.state, 1);
    await g.dispatchAsync(1, "pass-action", {}); // any dispatch rebuilds defeatedPlayers

    expect(g.state.defeatedPlayers).toContain(1);
  });

  it("survives the rebuild that happens on every dispatch", async () => {
    // The actual failure mode: pushed straight into defeatedPlayers, the loss lasts exactly until
    // the next action.
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    MarkPlayerLost(g.state, 1);
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.defeatedPlayers).toContain(1);
  });

  it("does not defeat the other player", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    MarkPlayerLost(g.state, 1);
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.defeatedPlayers).not.toContain(2);
  });

  it("leaves the ordinary base-damage loss working", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    g.state.player2.base.damage = 30;

    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.defeatedPlayers).toEqual([2]);
  });

  it("is inert until something marks it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.defeatedPlayers).toEqual([]);
  });
});
