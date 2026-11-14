import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_103 Disposable B1 (2/1 Ground, cost 1, Command/Villainy) —
//   "When Played: If another friendly unit entered play this phase (including leader and token
//    units), draw a card."
//
// "Another" — the B1's own entry doesn't count. A unit that was already in play when the phase
// began never entered this phase.

const B1 = Cards.units.hmw.disposableB1;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithActivePlayer(1);
}

describe("HMW_103 Disposable B1", () => {
  it("draws when another friendly unit entered play this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, B1).Build());

    await g.playCardFromHandAsync(1, 0); // the Marine enters
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // then the B1

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]); // drew the deck's Marine
    expect(g.state.player1.deck.length).toBe(0);
  });

  it("counts a deployed leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, B1).Build());

    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(1);
  });

  it("does not draw for its own entry alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, B1).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(0);
  });

  it("does not draw for a unit that was already in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, B1).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(0);
  });

  it("does not draw for an ENEMY unit that entered play", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithCardInHandForPlayer(1, B1)
      .WithCardInHandForPlayer(2, MARINE)
      .FillResourcesForPlayer(2, MARINE, 14)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(2, 0);
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(0);
  });
});
