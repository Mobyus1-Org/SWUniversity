import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_153 Poacher's Starfighter (3/1 Space, cost 2, Aggression/Villainy) —
//   "When Played: You may defeat this unit. If you do, create a Beast token and deal 1 damage to it."

const POACHER = Cards.units.hmw.poachersStarfighter;
const BEAST = Cards.units.token.beast;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Aggression/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, POACHER)
    .WithActivePlayer(1)
    .Build();
}

describe("HMW_153 Poacher's Starfighter", () => {
  it("Yes: defeats itself, then creates a Beast with 1 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.spaceArena.length).toBe(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(POACHER);
    const beast = g.state.player1.groundArena.find(u => u.cardId === BEAST);
    expect(beast?.damage).toBe(1);
  });

  it("No: it stays, and no Beast is made", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([POACHER]);
    expect(g.state.player1.groundArena.length).toBe(0);
  });
});
