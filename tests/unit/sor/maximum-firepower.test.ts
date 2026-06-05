import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_234 Maximum Firepower (Event) — Villainy, Cost 4
// A friendly Imperial unit deals damage equal to its power to a unit.
// Then, another friendly Imperial unit deals damage equal to its power to the same unit.
//
// Unit stats used in tests:
//   Death Trooper (SOR_033): 3/3 Imperial
//   Death Star Stormtrooper (SOR_128): 3/1 Imperial  (cost 1, power 3, hp 1)
//   Blizzard Assault AT-AT (SOR_088): 9/9             (survives both Imperial hits)

describe("SOR_234 Maximum Firepower", () => {
  it("two Imperial units each deal their power to the same target", async () => {
    // Death Trooper (3/3) + Stormtrooper (3/1) hit Blizzard AT-AT (9/9)
    // 3 + 3 = 6 total damage → Blizzard AT-AT survives with 3 HP
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper)          // Imperial 1: 3 power
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathStarStormtrooper) // Imperial 2: 3 power
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt)   // target: 9/9
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.maximumFirepower)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // pick death trooper
    await g.chooseGroundUnitAsync(2, 0); // pick blizzard AT-AT as target
    await g.chooseGroundUnitAsync(1, 1); // pick stormtrooper

    // Death Trooper (3) + Stormtrooper (3) = 6 total — Blizzard AT-AT (9 HP) survives
    expect(g.state.player2.groundArena[0]?.damage ?? 0).toBe(6);
  });

  it("only one damage application when only 1 Imperial unit is available", async () => {
    // Death Trooper (3/3) hits Blizzard AT-AT (9/9) — 3 damage, no second Imperial
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper)       // only 1 Imperial
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt) // 9/9 target
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.maximumFirepower)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // pick death trooper
    await g.chooseGroundUnitAsync(2, 0); // pick target

    // Only death trooper's 3 damage lands, no second step needed
    expect(g.state.player2.groundArena[0]?.damage ?? 0).toBe(3);
  });
});
