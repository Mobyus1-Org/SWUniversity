import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { AllCaptives } from "@/server/engine/core-functions";

// SEC_195 Arrest (Event, cost 2, Cunning/Villainy, Law) —
//   "Your base captures an enemy non-leader unit. At the start of the regroup phase, its owner
//    rescues it."
//
// The first card where the BASE is the captor rather than a unit, so the captive lives on
// `base.captives`. Capture rules are otherwise CR 8.33 as usual: the unit leaves play, loses its
// damage and upgrades, and a token is set aside instead of being held.

const ARREST = Cards.events.sec.arrest;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;
const BATTLE_DROID = Cards.units.token.battleDroid;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sec.drydenVos) // Cunning/Villainy — covers the event's aspects
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, ARREST)
    .WithActivePlayer(1);
}

describe("SEC_195 Arrest", () => {
  it("your BASE captures the chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);       // left play
    expect(g.state.player1.base.captives).toHaveLength(1);     // held by YOUR base
    expect(g.state.player1.base.captives![0].cardId).toBe(MARINE);
    expect(g.state.player1.base.captives![0].owner).toBe(2);   // still owned by its player
  });

  it("clears the captive's damage and upgrades (CR 8.33)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF, true, 3)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.sor.academyTraining, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const captive = g.state.player1.base.captives![0];
    expect(captive.damage).toBe(0);
    expect(captive.upgrades).toHaveLength(0);
  });

  it("a token is set aside, not held", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, BATTLE_DROID).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.base.captives ?? []).toHaveLength(0);
  });

  it("cannot target a LEADER unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(Cards.leaders.sor.sabineWren, true, true) // deployed leader unit
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.base.captives ?? []).toHaveLength(0);
  });

  it("cannot target a FRIENDLY unit — 'an enemy unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("a base captive is visible to AllCaptives()", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const captives = AllCaptives();
    expect(captives.map(c => c.cardId)).toContain(MARINE);
  });

  it("the owner rescues it at the start of the regroup phase, exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player1.base.captives).toHaveLength(1);

    // Both players pass to reach the regroup phase (turn order matters).
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.player1.base.captives ?? []).toHaveLength(0);
    const rescued = g.state.player2.groundArena.find(u => u.cardId === MARINE);
    expect(rescued).toBeDefined();
    expect(rescued!.controller).toBe(2);
    expect(rescued!.ready).toBe(false); // returns exhausted
  });
});
