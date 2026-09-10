import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_089 Consolidation of Power (Event, cost 6, Command/Villainy)
//   "Choose any number of friendly units. You may play a unit from your hand if its cost is less
//    than or equal to the combined power of the chosen units for free. Then, defeat the chosen
//    units."
//
// The chosen units die whether or not a unit is played.

const EVENT = Cards.events.twi.consolidationOfPower;
const MARINE = Cards.units.sor.battlefieldMarine;          // 3/3
const GUARDS = Cards.units.sor.vigilantHonorGuards;        // cost 5
const PRE = Cards.units.shd.preVizsla;                     // cost 7
const TRAINING = Cards.upgrades.sor.academyTraining;       // +2/+2

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Villainy + Command base — no penalty
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 6) // exactly the event's cost
    .WithCardInHandForPlayer(1, EVENT);
}

const ids = (g: GameTestAdapter, ...idx: number[]) => idx.map(i => g.state.player1.groundArena[i].playId);
const offer = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[]; needsMultiple?: boolean };
const handIndexOf = (g: GameTestAdapter, cardId: string) => g.state.player1.hand.findIndex(c => c.cardId === cardId);

describe("TWI_089 Consolidation of Power", () => {
  it("plays a hand unit costing ≤ the chosen units' combined power for free, then defeats them", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, GUARDS)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids(g, 0, 1) }); // 3 + 3 = 6
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, handIndexOf(g, GUARDS));

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([GUARDS]);
    expect(g.state.player1.discard.filter(c => c.cardId === MARINE)).toHaveLength(2);
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(0); // only the event was paid
  });

  it("offers only FRIENDLY units, any number", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, GUARDS).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g).fromPlayIds).toEqual(ids(g, 0));
    expect(offer(g).needsMultiple).toBe(true);
  });

  it("uses the units' current POWER — an upgraded 5-power unit alone pays for a 5-cost unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, GUARDS)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(TRAINING, 1)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids(g, 0) });
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, handIndexOf(g, GUARDS));

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([GUARDS]);
  });

  it("a unit costing MORE than the combined power can't be picked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, GUARDS)
        .WithCardInHandForPlayer(1, PRE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids(g, 0, 1) }); // 6
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, handIndexOf(g, PRE)); // costs 7

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player1.hand.some(c => c.cardId === PRE)).toBe(true);
  });

  it("declining the play still defeats the chosen units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, GUARDS).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids(g, 0, 1) }); // 6 — the Guards fit
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy(); // the "may play" offer
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([GUARDS]);
  });

  it("nothing in hand fits — no offer, and the chosen units are still defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, PRE).WithGroundUnitForPlayer(1, MARINE).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids(g, 0) }); // 3 < 7

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([PRE]);
  });

  it("choosing no units defeats nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, GUARDS).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.groundArena).toHaveLength(1);
  });
});
