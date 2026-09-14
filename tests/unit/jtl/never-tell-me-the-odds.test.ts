import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_208 Never Tell Me the Odds (Event, cost 3, Cunning/Heroism)
//   "Discard 3 cards from an opponent's deck and 3 cards from your deck. Deal damage to a unit equal
//    to the number of cards with an odd cost discarded this way."

const ODD_A = Cards.units.sor.deathStarStormtrooper; // cost 1
const ODD_B = Cards.events.sor.confiscate;           // cost 1
const EVEN_A = Cards.units.sor.battlefieldMarine;    // cost 2
const EVEN_B = Cards.units.sor.consularSecurityForce; // cost 4
const ZERO = Cards.events.sor.medalCeremony;         // no cost — counts as 0 (even)
const TARGET = Cards.units.lof.hyperspaceWayfarer;   // 4/10 Space

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, EVEN_A, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.neverTellMeTheOdds)
    .WithSpaceUnitForPlayer(2, TARGET);
}

type TargetRes = { type: string; helperText?: string; fromPlayIds?: string[] };

describe("JTL_208 Never Tell Me the Odds", () => {
  it("discards 3 from each deck and deals damage equal to the odd-cost cards among them", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInDeckForPlayer(2, ODD_A).WithCardInDeckForPlayer(2, EVEN_A).WithCardInDeckForPlayer(2, ODD_B)
      .WithCardInDeckForPlayer(1, EVEN_B).WithCardInDeckForPlayer(1, ODD_A).WithCardInDeckForPlayer(1, ZERO)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player2.deck).toHaveLength(0);
    const res = g.lastDispatchResponse?.resolutionNeeded as TargetRes;
    expect(res.type).toBe("Target");
    expect(res.helperText).toContain("3");

    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player2.spaceArena[0].damage).toBe(3);
  });

  it("only the TOP 3 cards of a longer deck are discarded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInDeckForPlayer(2, ODD_A) // bottom — stays
      .WithCardInDeckForPlayer(2, EVEN_A).WithCardInDeckForPlayer(2, EVEN_A).WithCardInDeckForPlayer(2, EVEN_B)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.deck.map(c => c.cardId)).toEqual([ODD_A]);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // 0 odd discarded
  });

  it("short decks discard what they have", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDeckForPlayer(2, ODD_A).WithCardInDeckForPlayer(2, ODD_B).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.discard.map(c => c.cardId)).toEqual(expect.arrayContaining([ODD_A, ODD_B]));
    expect(g.state.player2.spaceArena[0].damage).toBe(2);
  });

  it("any unit may be chosen, friendly included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, TARGET).WithCardInDeckForPlayer(1, ODD_A).Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as TargetRes;
    expect(res.fromPlayIds).toEqual(expect.arrayContaining([
      g.state.player1.spaceArena[0].playId, g.state.player2.spaceArena[0].playId,
    ]));
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena[0].damage).toBe(1);
  });

  it("both decks empty: nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("the discards are deck discards (when-discarded ledger)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDeckForPlayer(1, EVEN_A).Build());

    await g.playCardFromHandAsync(1, 0);

    expect((g.state.roundState.cardsDiscardedThisPhase ?? []).some(c => c.cardId === EVEN_A && c.from === "Deck")).toBe(true);
  });
});
