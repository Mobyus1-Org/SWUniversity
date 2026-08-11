import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_132 Imperial Occupier (2/2 Ground Imperial Trooper) — "When Defeated: Create a Spy token."
// Mandatory and targetless, so it resolves without a prompt.

const MARINE = Cards.units.sor.battlefieldMarine;   // 3 power — kills a 2-HP unit
const OCCUPIER = Cards.units.sec.imperialOccupier;
const SPY = Cards.units.token.spy;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14);
}

describe("SEC_132 Imperial Occupier", () => {
  it("creates a Spy token for its controller when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, OCCUPIER)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.some(u => u.cardId === OCCUPIER)).toBe(false);
    expect(g.state.player2.groundArena.some(u => u.cardId === SPY)).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === SPY)).toBe(false); // controller's, not the killer's
  });

  it("does not create a Spy while it is alive (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, OCCUPIER).Build());

    expect(g.state.player2.groundArena.some(u => u.cardId === SPY)).toBe(false);
  });

  it("fires for its owner when the owner's own copy dies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, OCCUPIER)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3 power
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // Occupier attacks and dies to the counter
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === OCCUPIER)).toBe(false);
    expect(g.state.player1.groundArena.some(u => u.cardId === SPY)).toBe(true);
  });
});
