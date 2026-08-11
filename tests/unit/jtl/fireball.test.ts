import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_198 Fireball — An Explosion With Wings (3/3 Space Vehicle)
//   "Ambush (When you play this unit, it may attack an enemy unit.)
//    When the regroup phase starts: Deal 1 damage to this unit."
//
// Ambush was already registered; the regroup-start self-damage is new, and needs a UNIT-level
// "when the regroup phase starts" trigger — the engine previously had only a leader-specific
// one (SHD_015 Doctor Aphra).

const MARINE = Cards.units.sor.battlefieldMarine;
const FIREBALL = Cards.units.jtl.fireball;

/** Active player starts as P1, so P1 passes first; two consecutive passes end the phase.
 *  Passing a THIRD time re-ends it and runs the regroup a second time — hence exactly two. */
async function passToRegroup(g: GameTestAdapter) {
  await g.dispatchAsync(1, "pass-action", {});
  await g.dispatchAsync(2, "pass-action", {});
}

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    // Deck cards so the regroup draw does not add empty-deck base damage to the picture.
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(2, MARINE)
    .WithCardInDeckForPlayer(2, MARINE);
}

describe("JTL_198 Fireball", () => {
  it("takes 1 damage to itself when the regroup phase starts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, FIREBALL).Build());
    expect(g.state.player1.spaceArena[0].damage).toBe(0);

    await passToRegroup(g);

    expect(g.state.player1.spaceArena[0].damage).toBe(1);
  });

  it("damages every copy in play, on either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, FIREBALL)
        .WithSpaceUnitForPlayer(2, FIREBALL)
        .Build(),
    );

    await passToRegroup(g);

    expect(g.state.player1.spaceArena[0].damage).toBe(1);
    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("does not damage a unit without the ability (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, FIREBALL)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await passToRegroup(g);

    expect(g.state.player1.spaceArena[0].damage).toBe(1);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("is defeated when the regroup damage is lethal", async () => {
    const g = new GameTestAdapter();
    // 3 HP with 2 damage already on it — the regroup point kills it.
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, FIREBALL, true, 2).Build());

    await passToRegroup(g);

    expect(g.state.player1.spaceArena).toHaveLength(0);
  });

  it("keeps Ambush — it may attack an enemy unit as it enters", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(1, FIREBALL)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10 — survives
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined(); // Ambush prompt
  });
});
