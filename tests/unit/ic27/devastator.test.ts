import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_068 Devastator — Lord Vader's Flagship (9/9 Space, cost 10, Command/Villainy)
//   "Overwhelm. When Played: Search the top 5 cards of your deck for a Villainy unit that costs 12 or
//    less and play it for free. (Put the other cards on the bottom of your deck in a random order.)"

const DEVASTATOR = Cards.units.ic27.devastator;
const VADER = Cards.units.sor.darthVader;               // Villainy unit, cost 7
const STORMTROOPER = Cards.units.sor.deathStarStormtrooper; // Villainy unit, cost 1
const MARINE = Cards.units.sor.battlefieldMarine;       // Heroism unit
const TIE = Cards.units.sor.tieLnFighter;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10);
}

type Choices = { choices: { tempId: string; cardId: string }[] };

describe("IC27_068 Devastator — When Played", () => {
  it("offers only Villainy units from the top 5 and plays the pick for free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithCardInHandForPlayer(1, DEVASTATOR)
      .WithCardInDeckForPlayer(1, STORMTROOPER) // 6th from the top — out of reach
      .WithCardInDeckForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(1, VADER)
      .WithCardInDeckForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(1, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as unknown as Choices;
    expect(res.choices.map(c => c.cardId)).toEqual([VADER]);
    await g.chooseDeckSearchAsync(1, [res.choices[0].tempId]);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([VADER]);
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(0); // Devastator's 10, Vader free
    expect(g.state.player1.deck).toHaveLength(5);
  });

  it("with no Villainy unit in the top 5 nothing is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithCardInHandForPlayer(1, DEVASTATOR)
      .WithCardInDeckForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(1, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(0);
  });
});

describe("IC27_068 Devastator — Overwhelm", () => {
  it("excess damage from attacking a unit goes to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, DEVASTATOR).WithSpaceUnitForPlayer(2, TIE).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(8);
  });
});
