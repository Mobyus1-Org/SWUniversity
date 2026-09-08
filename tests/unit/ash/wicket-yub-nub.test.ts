import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_034 Wicket — Yub Nub! Cost 1, 3/3 Ground Ewok, unique.
//   "Saboteur
//    This unit can't attack bases."
//
// The base restriction is PRINTED, not granted by another card, so unlike Fly Casual or Niman
// Strike it must hold for a Wicket that was never played — one placed directly on the board by a
// puzzle, for instance.

const WICKET = Cards.units.ash.wicket;
const SHIELD = Cards.upgrades.token.shield;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_034 Wicket — Yub Nub!", () => {
  it("cannot attack a base — Base is not offered and choosing it is rejected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, WICKET)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);

    const resolution = g.lastDispatchResponse?.resolutionNeeded as { fromZones?: string[] };
    expect(resolution.fromZones ?? []).not.toContain("Base");

    const result = await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"], targetPlayers: [2] });
    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("still attacks units normally", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, WICKET)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7, survives
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("control: a unit WITHOUT the restriction is offered the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);

    const resolution = g.lastDispatchResponse?.resolutionNeeded as { fromZones?: string[] };
    expect(resolution.fromZones ?? []).toContain("Base");
  });

  it("has Saboteur — the defender's Shield token is defeated before damage, not spent on it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, WICKET)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHIELD, 2)])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const defender = g.state.player2.groundArena[0];
    expect(defender.upgrades.filter(u => u.cardId === SHIELD)).toHaveLength(0);
    // Without Saboteur the Shield would have absorbed all 3; with it, the damage lands.
    expect(defender.damage).toBe(3);
  });
});
