import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import type { NeedsDeckSearch } from "@/lib/engine/message-types";

// SEC_001 Chancellor Palpatine — How Liberty Dies (leader; 6/8 Ground deployed, Vigilance/Villainy)
//   Front: "Action [1 resource, Exhaust]: Search the top 5 cards of your deck for a card with Plot,
//           reveal it, and draw it."
//   Deployed: "When Deployed: The next card you play using Plot this phase costs 3 resources less."
//
// Only a Plot card may be drawn from the five. The discount is spent by the first Plot play.

const PALPATINE = Cards.leaders.sec.chancellorPalpatine;
const JARJAR = Cards.units.sec.jarJarBinksMesaPropose; // Plot, cost 2, Command
const GARINDAN = Cards.units.sec.garindan;             // Plot, cost 2, Cunning/Villainy
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(PALPATINE)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

describe("SEC_001 Chancellor Palpatine — leader Action", () => {
  it("offers only the Plot cards among the top 5, and draws the one chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .FillResourcesForPlayer(1, MARINE, 10)
        .WithCardInDeckForPlayer(1, JARJAR)  // 6th from the top — out of reach
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, GARINDAN)
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, MARINE)  // top
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    const search = g.lastDispatchResponse?.resolutionNeeded as NeedsDeckSearch;
    expect(search?.type).toBe("DeckSearch");
    expect(search.choices.map(c => c.cardId)).toEqual([GARINDAN]); // only the Plot card is offered
    await g.chooseDeckSearchAsync(1, [search.choices[0].tempId]);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([GARINDAN]);
    expect(g.state.player1.leader.ready).toBe(false);
  });
});

describe("SEC_001 Chancellor Palpatine — When Deployed", () => {
  function deploying() {
    return setup()
      .FillResourcesForPlayer(1, MARINE, 7)
      .FillResourcesForPlayer(1, GARINDAN, 1) // resource index 7
      .WithCardInHandForPlayer(2, MARINE);
  }

  it("the next Plot card played this phase costs 3 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deploying().Build());

    await g.deployLeaderAsync(1);
    await g.chooseOptionAsync(1, "When Deployed First");
    await g.choosePlotCardAsync(1, 7);

    expect(g.state.player1.groundArena.some(u => u.cardId === GARINDAN)).toBe(true);
    // Garindan costs 2 + a Cunning penalty of 2 = 4; 3 less = 1.
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
  });

  it("only the FIRST Plot card is discounted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deploying().FillResourcesForPlayer(1, JARJAR, 1).Build()); // index 8: Jar Jar, 2 + Command penalty 2

    await g.deployLeaderAsync(1);
    await g.chooseOptionAsync(1, "When Deployed First");
    await g.choosePlotCardAsync(1, 8); // Jar Jar: 4 − 3 = 1
    await g.chooseNoAsync(1);          // decline his own When Played
    const garindanIdx = g.state.player1.resources.findIndex(r => r.cardId === GARINDAN);
    await g.choosePlotCardAsync(1, garindanIdx); // Garindan: the full 4

    expect(g.state.player1.groundArena.some(u => u.cardId === GARINDAN)).toBe(true);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1 + 4);
  });
});
