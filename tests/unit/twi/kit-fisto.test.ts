import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_165 Kit Fisto — The Smiling Jedi (7/6 Ground Force Jedi Republic)
//   "Saboteur
//    Coordinate — On Attack: You may deal 3 damage to a ground unit.
//    (Gain this ability while you control 3 or more units.)"
//
// Saboteur and the Coordinate flag were already registered; the granted effect was not.
// Coordinate is CONDITIONAL — at fewer than 3 friendly units the On Attack must not fire at all.

const MARINE = Cards.units.sor.battlefieldMarine;
const KIT = Cards.units.twi.kitFisto;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 — survives 3 damage

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 16)
    .WithGroundUnitForPlayer(2, CSF);
}

describe("TWI_165 Kit Fisto", () => {
  it("deals 3 damage to a chosen ground unit while Coordinate is active", async () => {
    const g = new GameTestAdapter();
    // Kit + 2 more friendly units = 3, so Coordinate is on.
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, KIT)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("can decline the optional damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, KIT)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does NOT fire with fewer than 3 friendly units (Coordinate off)", async () => {
    const g = new GameTestAdapter();
    // Kit + 1 = 2 units, below the Coordinate threshold.
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, KIT)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(7); // the attack still resolved
  });

  it("keeps Saboteur — it ignores Sentinel when attacking", async () => {
    const g = new GameTestAdapter();
    const { HasSaboteur } = await import("@/server/engine/card-db/keyword-dictionaries.ts/saboteur");
    g.loadNewState(setup().WithGroundUnitForPlayer(1, KIT).Build());
    expect(HasSaboteur(KIT, g.state.player1.groundArena[0].playId, 1)).toBe(true);
  });
});
