import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_094 Palpatine's Return — cost 6 Command/Villainy event.
// "Play a unit from your discard pile. It costs 6 resources less. If it's a Force unit, it costs
//  8 resources less instead."
//
// Base (Command) + leader Chirrut Îmwe (Vigilance/Heroism) cover both fixtures' aspects, so the
// discounted costs below carry no aspect penalty:
//   97th Legion (SOR_118)   — Command,        cost 7, non-Force → 7 - 6 = 1
//   Luke Skywalker (SOR_051) — Vigilance/Heroism, cost 7, Force → 7 - 8 = 0
// The event itself is Command/Villainy, so it costs 6 + 2 (Villainy penalty) = 8.

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP) // Command Center
    .MyLeader(Cards.leaders.sor.chirrutImwe) // Vigilance / Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.shd.palpatinesReturn);
}

const readyCount = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

/** The playId of a specific card in player 1's discard (the event itself lands there too). */
const discardPlayId = (g: GameTestAdapter, cardId: string) =>
  g.state.player1.discard.find(d => d.cardId === cardId)!.playId;

describe("SHD_094 Palpatine's Return", () => {
  it("plays a non-Force unit from the discard for 6 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithCardInDiscardForPlayer(1, Cards.units.sor.ninetySeventhLegion).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(readyCount(g)).toBe(6); // 14 - 8 for the event

    const targetPlayId = discardPlayId(g, Cards.units.sor.ninetySeventhLegion);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(Cards.units.sor.ninetySeventhLegion);
    expect(readyCount(g)).toBe(5); // cost 7 - 6 = 1
    // Only the event itself is left in the discard.
    expect(g.state.player1.discard.map(d => d.cardId)).toEqual([Cards.events.shd.palpatinesReturn]);
  });

  it("plays a FORCE unit for 8 less instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithCardInDiscardForPlayer(1, Cards.units.sor.lukeSkywalker).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(readyCount(g)).toBe(6);

    const targetPlayId = discardPlayId(g, Cards.units.sor.lukeSkywalker);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(Cards.units.sor.lukeSkywalker);
    expect(readyCount(g)).toBe(6); // cost 7 - 8, floored at 0
  });

  it("only units are eligible — an event in the discard is not offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithCardInDiscardForPlayer(1, Cards.events.sor.vanquish)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.ninetySeventhLegion)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const vanquishPlayId = g.state.player1.discard.find(
      d => d.cardId === Cards.events.sor.vanquish,
    )!.playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vanquishPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.events.sor.vanquish);
  });

  it("does not prompt when the discard holds no unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithCardInDiscardForPlayer(1, Cards.events.sor.vanquish).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("does not offer a unit you cannot afford even after the discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.chirrutImwe)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8) // exactly the event's cost
        .WithCardInHandForPlayer(1, Cards.events.shd.palpatinesReturn)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.ninetySeventhLegion) // would still cost 1
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(readyCount(g)).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.sor.ninetySeventhLegion)).toBe(true);
  });

  it("reads YOUR discard pile, not the opponent's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithCardInDiscardForPlayer(2, Cards.units.sor.ninetySeventhLegion).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.discard).toHaveLength(1);
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("the unit enters play exhausted, like a normally played unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithCardInDiscardForPlayer(1, Cards.units.sor.ninetySeventhLegion).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const targetPlayId = discardPlayId(g, Cards.units.sor.ninetySeventhLegion);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
