import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// TWI_034 General Grievous — Trophy Collector. Cost 3, 4/4 Ground Separatist/Official, unique.
//   "Ignore the aspect penalty on each Lightsaber upgrade you play on this unit.
//    On Attack: If this unit has 4 or more Lightsaber upgrades attached to him, defeat 4 enemy
//    units."
//
// ⚠ Only the On Attack half is implemented. The aspect-penalty waiver is host-specific, and the
// engine charges an upgrade's cost BEFORE its host is chosen, so there is nowhere correct to apply
// it yet. See the batch report.

const GRIEVOUS = Cards.units.twi.generalGrievousTrophyCollector;
const SABER = "LOF_090";   // Inquisitor's Lightsaber — a Lightsaber-trait upgrade
const NON_SABER = Cards.upgrades.sor.academyTraining;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const sabers = (n: number) =>
  Array.from({ length: n }, () => GameStateBuilder.Upgrade(SABER, 1));

describe("TWI_034 General Grievous — Trophy Collector (On Attack)", () => {
  it("defeats the chosen enemy units when he carries 4 Lightsabers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, sabers(4))
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );
    const victims = g.state.player2.groundArena.map(u => u.playId);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: victims });

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("does nothing with only 3 Lightsabers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, sabers(3))
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("counts LIGHTSABERS specifically, not upgrades in general", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          ...sabers(3),
          GameStateBuilder.Upgrade(NON_SABER, 1), // 4 upgrades, only 3 Lightsabers
        ])
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("offers only ENEMY units, capped at 4", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, sabers(4))
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[]; maxTargets?: number };
    expect(res.fromPlayIds).toEqual([g.state.player2.groundArena[0].playId]);
    expect(res.maxTargets).toBe(4);
  });
});
