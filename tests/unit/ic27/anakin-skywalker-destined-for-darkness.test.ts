import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { aspectPenalty, playCost } from "@/server/engine/card-playability";

// IC27_078 Anakin Skywalker — Destined for Darkness (7/4 Ground, cost 5, Command/Heroism)
//   "When Defeated: Search your deck for a card named Darth Vader, reveal it, and draw it.
//    While this unit is in your discard pile, ignore the aspect penalties on cards you play named
//    Darth Vader."

const ANAKIN = Cards.units.ic27.anakinSkywalker;
const VADER = Cards.units.sor.darthVader;          // SOR_087, cost 7, Command/Villainy
const VADER_IC27 = Cards.units.ic27.darthVader;    // IC27_067, cost 8, Command/Villainy
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;
const STORMTROOPER = Cards.units.sor.deathStarStormtrooper; // Aggression/Villainy, not a Vader
const RIVALS_FALL = Cards.events.shd.rivalsFall;

// Luke (Vigilance/Heroism) + Command base: Villainy is uncovered, so a Vader carries a penalty.
function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

describe("IC27_078 Anakin Skywalker — When Defeated search", () => {
  async function defeatAnakin(g: GameTestAdapter) {
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
  }

  it("offers only cards named Darth Vader from anywhere in the deck, and draws the pick", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithCardInHandForPlayer(1, RIVALS_FALL)
      .WithGroundUnitForPlayer(1, ANAKIN)
      .WithCardInDeckForPlayer(1, VADER)       // bottom of the deck
      .WithCardInDeckForPlayer(1, SECURITY)
      .WithCardInDeckForPlayer(1, MARINE)
      .Build());

    await defeatAnakin(g);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("DeckSearch");
    const choices = (res as unknown as { choices: { tempId: string; cardId: string }[] }).choices;
    expect(choices.map(c => c.cardId)).toEqual([VADER]);
    await g.chooseDeckSearchAsync(1, [choices[0].tempId]);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([VADER]);
    expect(g.state.player1.deck).toHaveLength(2);
  });

  it("with no Darth Vader in the deck nothing is drawn", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithCardInHandForPlayer(1, RIVALS_FALL)
      .WithGroundUnitForPlayer(1, ANAKIN)
      .WithCardInDeckForPlayer(1, SECURITY)
      .Build());

    await defeatAnakin(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
  });
});

describe("IC27_078 Anakin Skywalker — aspect waiver from the discard pile", () => {
  it("while he is in your discard pile, Darth Vader cards you play have no aspect penalty", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, ANAKIN).Build());

    expect(aspectPenalty(g.state, 1, VADER)).toBe(0);
    expect(aspectPenalty(g.state, 1, VADER_IC27)).toBe(0);
    expect(playCost(g.state, 1, VADER)).toBe(7);
  });

  it("only cards named Darth Vader — another Villainy card still pays", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, ANAKIN).Build());

    expect(aspectPenalty(g.state, 1, STORMTROOPER)).toBeGreaterThan(0);
  });

  it("control: Anakin in play (not the discard) waives nothing", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, ANAKIN).Build());

    expect(aspectPenalty(g.state, 1, VADER)).toBe(2);
  });

  it("only YOUR discard pile — Anakin in the opponent's discard doesn't help you", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(2, ANAKIN).Build());

    expect(aspectPenalty(g.state, 1, VADER)).toBe(2);
  });

  it("is honoured on a real play: 7 resources is enough for the 7-cost Vader", async () => {
    const g = new GameTestAdapter();
    const state = board().WithCardInDiscardForPlayer(1, ANAKIN).WithCardInHandForPlayer(1, VADER).Build();
    state.player1.resources = state.player1.resources.slice(0, 7);
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([VADER]);
  });
});
