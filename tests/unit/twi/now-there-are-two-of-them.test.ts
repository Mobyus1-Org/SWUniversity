import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_225 Now There Are Two of Them (Event, cost 3, Cunning, Trick)
//   "If you control exactly one unit, play a non-Vehicle unit from your hand that shares a Trait
//    with the unit you control. It costs 5 resources less."
//
// Blue base + Sabine cover Vigilance/Aggression/Heroism, so the event pays a 2-resource Cunning
// penalty (5 total). The discount comes off the FULL cost, aspect penalty included.

const EVENT = Cards.events.twi.nowThereAreTwoOfThem;
const MARINE = Cards.units.sor.battlefieldMarine;          // Rebel/Trooper, 3/3 — the one unit
const CONSULAR = Cards.units.sor.consularSecurityForce;    // Rebel/Trooper, cost 4, Vigilance/Heroism
const DEATH_TROOPERS = Cards.units.ash.deathTrooperSquad;  // Imperial/Trooper, cost 4, Villainy (+2)
const DIANOGA = Cards.units.hmw.filthyDianoga;             // Creature — shares nothing with the Marine
const X_WING = Cards.units.sor.allianceXWing;              // Rebel, but a Vehicle

function setup(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, DIANOGA, resources)
    .WithCardInHandForPlayer(1, EVENT);
}

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("TWI_225 Now There Are Two of Them", () => {
  it("with exactly one unit, plays a trait-sharing unit for 5 less (cost 4 → free)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, CONSULAR).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE, CONSULAR]);
    expect(readyResources(g)).toBe(0);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("the discount is off the full cost — aspect penalty included (4 + 2 − 5 = 1)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(7).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, DEATH_TROOPERS).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === DEATH_TROOPERS)).toBe(true);
    expect(readyResources(g)).toBe(1); // 7 − 5 (event) − 1
  });

  it("offers only non-Vehicle units sharing a Trait with the unit you control", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(10)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, DIANOGA)   // hand idx 0 after the event leaves
        .WithCardInHandForPlayer(1, X_WING)    // idx 1
        .WithCardInHandForPlayer(1, CONSULAR)  // idx 2
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromIndices?: number[] };
    expect(res.fromIndices).toEqual([2]);

    await g.chooseCardFromHandAsync(1, 0); // the Dianoga — rejected
    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("the play may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, CONSULAR).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([CONSULAR]);
  });

  it("two units in play: nothing happens (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(5)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, CONSULAR)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([CONSULAR]);
  });

  it("no units in play: nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).WithCardInHandForPlayer(1, CONSULAR).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("an enemy unit doesn't count toward 'you control' — one friendly + enemies still qualifies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(5)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(1, CONSULAR)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });
});
