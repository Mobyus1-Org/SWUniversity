import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_078 Hyperspace Disaster (Event, cost 7) — "Defeat all space units."
// Indiscriminate: both players, every space unit, leader units included. Ground is untouched.

const MARINE = Cards.units.sor.battlefieldMarine;      // Ground
const AWING = Cards.units.jtl.phoenixSquadronAWing;    // Space
const WAYFARER = Cards.units.lof.hyperspaceWayfarer;   // Space, 4/10

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 16)
    .WithCardInHandForPlayer(1, Cards.events.sec.hyperspaceDisaster);
}

describe("SEC_078 Hyperspace Disaster", () => {
  it("defeats every space unit on both sides", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, AWING)
        .WithSpaceUnitForPlayer(1, WAYFARER)
        .WithSpaceUnitForPlayer(2, AWING)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("leaves ground units untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, AWING)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].damage).toBe(0); // defeated, not damaged
  });

  it("defeats a high-HP space unit regardless of damage", async () => {
    const g = new GameTestAdapter();
    // Hyperspace Wayfarer is 4/10 and undamaged — "defeat" ignores HP entirely.
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, WAYFARER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.discard.some(d => d.cardId === WAYFARER)).toBe(true);
  });

  it("resolves harmlessly with no space units in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });
});
