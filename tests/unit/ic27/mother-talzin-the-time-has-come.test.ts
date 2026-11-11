import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_066 Mother Talzin — The Time Has Come (5/5 Ground, cost 7, Command/Villainy)
//   "When Played: You may play a Villainy unit that costs 4 or less from your discard pile for free.
//    If it's not a Night or Undead unit, deal damage equal to its cost to this unit."

const TALZIN = Cards.units.ic27.motherTalzin;
const DEATH_TROOPERS = Cards.units.ash.deathTrooperSquad; // 5/4 Villainy, cost 4, no text
const ASSASSIN = Cards.units.lof.talzinsAssassin;         // Villainy Night, cost 4
const SHADE = Cards.units.lof.deceptiveShade;              // Villainy Undead (not Night), cost 2
const VADER = Cards.units.sor.darthVader;                  // Villainy, cost 7 — too expensive
const MARINE = Cards.units.sor.battlefieldMarine;          // Heroism, cost 2 — not Villainy

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 7)
    .WithCardInHandForPlayer(1, TALZIN);
}

const talzin = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === TALZIN);
const discardId = (g: GameTestAdapter, cardId: string) => g.state.player1.discard.find(d => d.cardId === cardId)!.playId;

describe("IC27_066 Mother Talzin — The Time Has Come", () => {
  it("offers only Villainy units costing 4 or less from the discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithCardInDiscardForPlayer(1, DEATH_TROOPERS)
      .WithCardInDiscardForPlayer(1, VADER)
      .WithCardInDiscardForPlayer(1, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as unknown as { fromPlayIds?: string[] };

    expect(res.fromPlayIds).toEqual([discardId(g, DEATH_TROOPERS)]);
  });

  it("a non-Night, non-Undead unit is played for free and she takes damage equal to its cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, DEATH_TROOPERS).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId(g, DEATH_TROOPERS)] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(DEATH_TROOPERS);
    expect(talzin(g)!.damage).toBe(4);
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(0); // Talzin's 7 only
  });

  it("a Night unit costs her nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, ASSASSIN).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId(g, ASSASSIN)] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(ASSASSIN);
    expect(talzin(g)!.damage).toBe(0);
  });

  it("an Undead unit costs her nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, SHADE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId(g, SHADE)] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(SHADE);
    expect(talzin(g)!.damage).toBe(0);
  });

  it("the damage can defeat her", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, DEATH_TROOPERS).Build());

    await g.playCardFromHandAsync(1, 0);
    talzin(g)!.damage = 2; // 2 + 4 ≥ 5
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId(g, DEATH_TROOPERS)] });

    expect(talzin(g)).toBeUndefined();
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(TALZIN);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([DEATH_TROOPERS]);
  });

  it("choosing nothing declines: no play, no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, DEATH_TROOPERS).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([TALZIN]);
    expect(talzin(g)!.damage).toBe(0);
  });

  it("no prompt when nothing in the discard qualifies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, VADER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
