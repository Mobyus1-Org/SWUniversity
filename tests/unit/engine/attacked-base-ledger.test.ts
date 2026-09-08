import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { UnitsThatAttackedBase } from "@/server/engine/core-functions";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";

// Engine mechanic: which units attacked a given BASE this phase.
//
// roundState.unitsAttackedThisPhase recorded who attacked but not what they attacked, so
// "each enemy non-leader unit that attacked your base this phase" (SHD_106 Rule with Respect,
// SHD_088 Ephant Mon) could not be answered at all.
//
// The ledger is round-scoped puzzle state, so the round-trip test below is not optional: a field
// that survives in memory but is dropped by the puzzle hydrator works in every unit test and
// silently vanishes in every actual puzzle.

const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithActivePlayer(1);
}

describe("units that attacked a base this phase", () => {
  it("records an attack on a base against that base's player", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(UnitsThatAttackedBase(2).map(e => e.cardId)).toEqual([MARINE]);
    expect(UnitsThatAttackedBase(1)).toEqual([]);
  });

  it("does NOT record an attack on a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(UnitsThatAttackedBase(2)).toEqual([]);
  });

  it("records several attackers in order", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, CSF)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(UnitsThatAttackedBase(2).map(e => e.cardId)).toEqual([MARINE, CSF]);
  });

  it("survives a puzzle hydrate — the mirror carries it", () => {
    // The failure this guards: an added field that the hydrator drops. Every in-memory test
    // still passes; every real puzzle loses it.
    const raw = {
      ...JSON.parse(JSON.stringify(setup().Build())),
      roundState: {
        ...JSON.parse(JSON.stringify(setup().Build())).roundState,
        unitsAttackedThisPhase: [
          { fromPlayer: 1, cardId: MARINE, playId: "7", attackedBasePlayer: 2 },
        ],
      },
    };

    const hydrated = hydratePuzzleGame(raw);

    expect(hydrated.roundState.unitsAttackedThisPhase).toEqual([
      { fromPlayer: 1, cardId: MARINE, playId: "7", attackedBasePlayer: 2 },
    ]);
  });
});
