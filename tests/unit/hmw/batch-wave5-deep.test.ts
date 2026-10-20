import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// Wave 5b — the two deep ones.
//
//   HMW_051 Third Sister  6/3  "Overwhelm. When Played: You may deal 2 damage to a unit. If you do,
//                               THAT UNIT'S CONTROLLER may deal 3 damage to a unit. If they do,
//                               THAT UNIT'S CONTROLLER may deal 4 damage to a unit."
//                              The acting player changes at each step, following whoever controls
//                              the unit that was just hit — so the chain can bounce back and forth.
//
//                              CAVEAT: that alternation is implemented (the next step's pending is
//                              built for the damaged unit's controller, read BEFORE the damage so a
//                              unit that dies still decides who acts) but it is NOT observable from
//                              these tests: the harness does not enforce which player answers a
//                              pending, and both steps offer the same pool (every unit). The tests
//                              below pin the amounts, the chain length and the optionality.
//
//   HMW_043 Darth Vader   9/8  "Saboteur. When Played: Search the top 8 cards of your deck for up
//                               to 2 units that each cost 4 or less, play them for free, and deal
//                               2 damage to each of them."
const SISTER = Cards.units.hmw.thirdSister;
const VADER = Cards.units.hmw.darthVaderAnyMethods;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground, cost 2
const TURTLE = Cards.units.ash.dinosaurTurtle;         // 7/7 Ground, cost 6 — too big for Vader
const SPEEDER = Cards.units.sec.skyhopperCanyonRunner; // 1/4 Ground, cost 1

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
/** The deck-search choices on offer, as the other search tests read them. */
const searchChoices = (g: GameTestAdapter) =>
  (needs(g) as { choices?: { tempId: string; cardId: string }[] } | undefined)?.choices ?? [];

describe("HMW_051 Third Sister — the alternating damage chain", () => {
  it("has Overwhelm", () => {
    expect(HasOverwhelm(SISTER)).toBe(true);
  });

  it("step 1 deals 2, and a second offer follows", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, TURTLE) // 7/7 survives 2
      .WithCardInHandForPlayer(1, SISTER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    // A second offer follows (held by the hit unit's controller — see the caveat above).
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(2);
    expect(needs(g)).toBeUndefined();
  });

  it("the whole chain deals 2, then 3, then 4, and then stops", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, TURTLE) // P1's, survives everything
      .WithGroundUnitForPlayer(2, TURTLE) // P2's
      .WithCardInHandForPlayer(1, SISTER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);           // P1 deals 2 to P2's Turtle
    expect(g.state.player2.groundArena[0].damage).toBe(2);

    await g.chooseYesAsync(2);
    await g.chooseGroundUnitAsync(1, 0);           // P2 deals 3 to P1's Turtle
    expect(g.state.player1.groundArena.find(x => x.cardId === TURTLE)!.damage).toBe(3);

    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);           // P1 deals 4 back
    expect(g.state.player2.groundArena[0].damage).toBe(6); // 2 + 4

    expect(needs(g)).toBeUndefined(); // the chain ends after step 3
  });

  it("declining step 1 ends it immediately", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, TURTLE)
      .WithCardInHandForPlayer(1, SISTER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(needs(g)).toBeUndefined();
  });

  it("hitting your OWN unit still continues the chain", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, TURTLE)
      .WithCardInHandForPlayer(1, SISTER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // P1 hits their own Turtle

    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena.find(x => x.cardId === TURTLE)!.damage).toBe(5); // 2 + 3
  });
});

describe("HMW_043 Darth Vader — Any Methods Necessary", () => {
  function setup(deck: string[]) {
    let b = base().WithCardInHandForPlayer(1, VADER);
    for (const c of deck) b = b.WithCardInDeckForPlayer(1, c);
    return b;
  }

  it("has Saboteur", () => {
    expect(HasSaboteur(VADER)).toBe(true);
  });

  it("plays up to 2 cheap units from the top 8 for free, each taking 2 damage", async () => {
    const g = new GameTestAdapter();
    // Deck is drawn from the END, so these are the top cards.
    g.loadNewState(setup([MARINE, SPEEDER]).Build());
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;

    await g.playCardFromHandAsync(1, 0);
    expect(searchChoices(g)).toHaveLength(2);
    await g.chooseDeckSearchAsync(1, searchChoices(g).map(c => c.tempId));

    const marine = g.state.player1.groundArena.find(x => x.cardId === MARINE)!;
    const speeder = g.state.player1.groundArena.find(x => x.cardId === SPEEDER)!;
    expect(marine.damage).toBe(2);
    expect(speeder.damage).toBe(2);
    // Vader's own 9 was paid from hand; the two units cost nothing on top of that.
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore - 9);
  });

  it("only offers units costing 4 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([TURTLE, MARINE]).Build()); // Turtle is cost 6

    await g.playCardFromHandAsync(1, 0);

    expect(searchChoices(g).map(c => c.cardId)).toEqual([MARINE]);
  });

  it("'up to 2' means one is a legal answer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([MARINE, SPEEDER]).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseDeckSearchAsync(1, [searchChoices(g)[0].tempId]);

    expect(g.state.player1.groundArena).toHaveLength(2); // Vader + the one chosen
  });

  it("the 2 damage can be lethal to a 1-HP unit", async () => {
    const g = new GameTestAdapter();
    const DROID = Cards.units.token.battleDroid; // not in a deck normally, but 1/1 is the point
    g.loadNewState(setup([Cards.units.ash.perideaBandit]).Build()); // 4/1 Ground, cost 2
    void DROID;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseDeckSearchAsync(1, searchChoices(g).map(c => c.tempId));

    // 4/1 takes 2 and dies on the way in.
    expect(g.state.player1.groundArena.some(x => x.cardId === Cards.units.ash.perideaBandit)).toBe(false);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.ash.perideaBandit)).toBe(true);
  });

  it("does nothing with no eligible unit in the top 8", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([TURTLE, TURTLE]).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeUndefined();
    expect(g.state.player1.groundArena).toHaveLength(1); // Vader alone
  });

  it("looks no deeper than 8 cards", async () => {
    const g = new GameTestAdapter();
    // 8 Turtles on top, the cheap Marine buried at position 9 from the top.
    g.loadNewState(setup([MARINE, TURTLE, TURTLE, TURTLE, TURTLE, TURTLE, TURTLE, TURTLE, TURTLE]).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeUndefined();
    expect(g.state.player1.groundArena.some(x => x.cardId === MARINE)).toBe(false);
  });
});
