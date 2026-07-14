import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// LOF_100 — Kelleran Beq (cost 7, Command+Heroism)
// When Played: Search the top 7 cards of your deck for a unit, reveal it, and play it. It costs 3 resources less.
// Using "gw" (Leia Organa — Command+Heroism) so no aspect penalties on Kelleran Beq or Command/Heroism units in deck.

describe("LOF_100 — Kelleran Beq", () => {
  it("plays the chosen unit with cost reduced to 0 (cost 3 unit)", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 7 }, their: {} })
      .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender) // cost 3, Command+Heroism; 3 - 3 = 0
      .WithCardInHandForPlayer(1, Cards.units.lof.kelleranBeq)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // play Kelleran Beq (costs 7, leaves 0 ready)
    await g.chooseDeckSearchAsync(1, ["0"]);

    // Kelleran Beq + echoBaseDefender both in arena
    expect(g.state.player1.groundArena.length).toBe(2);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.echoBaseDefender)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0); // 7 - 7 - 0 = 0
  });

  it("charges the reduced cost when playing a higher-cost unit", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 9 }, their: {} })
      .WithCardInDeckForPlayer(1, Cards.units.sor.brightHope) // cost 4, Command+Heroism; 4 - 3 = 1
      .WithCardInHandForPlayer(1, Cards.units.lof.kelleranBeq)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // play Kelleran Beq (costs 7)
    await g.chooseDeckSearchAsync(1, ["0"]);

    // Kelleran Beq in ground arena, brightHope (space unit) in space arena
    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player1.spaceArena.length).toBe(1);
    expect(g.state.player1.spaceArena[0].cardId).toBe(Cards.units.sor.brightHope);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(1); // 9 - 7 - 1 = 1
  });

  it("only shows units from the top 7 as eligible", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 7 }, their: {} })
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // card 1 (bottom of top 7)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // card 2
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // card 3
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // card 4
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // card 5
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // card 6
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // card 7 (top)
      .WithCardInHandForPlayer(1, Cards.units.lof.kelleranBeq)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseDeckSearchAsync(1, ["0"]);

    // Kelleran Beq + searched unit both in arena
    expect(g.state.player1.groundArena.length).toBe(2);
  });

  it("does NOT reach a unit sitting below the top 7", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 9 }, their: {} })
      // Added first = bottom of the deck. It is the 8th card down, so out of reach.
      .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender)
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace)
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace)
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace)
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace)
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace)
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace)
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace) // 7 events fill the top 7
      .WithCardInHandForPlayer(1, Cards.units.lof.kelleranBeq)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // The only unit is the 8th card, so the search finds nothing.
    expect(g.state.player1.groundArena.length).toBe(1); // Kelleran alone
    expect(
      g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.echoBaseDefender),
    ).toBe(false);
    expect(g.state.player1.deck.length).toBe(8); // every card stays in the deck
  });

  it("puts the cards it looked at but did not take on the bottom of the deck", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 9 }, their: {} })
      // Only ONE unit in the deck, so the search pick is unambiguous.
      .WithCardInDeckForPlayer(1, Cards.events.sor.takedown) // bottom
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace) // looked at, not taken
      .WithCardInDeckForPlayer(1, Cards.units.sor.echoBaseDefender) // top — the unit that gets played
      .WithCardInHandForPlayer(1, Cards.units.lof.kelleranBeq)
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    // tempIds are indices into the searched window, so read the offered choice rather
    // than assuming "0".
    const search = played.lastDispatchResponse?.resolutionNeeded as { choices: { tempId: string; cardId: string }[] };
    expect(search.choices.map(c => c.cardId)).toEqual([Cards.units.sor.echoBaseDefender]); // only the unit
    await g.chooseDeckSearchAsync(1, [search.choices[0].tempId]);

    expect(
      g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.echoBaseDefender),
    ).toBe(true);
    // The searched card left the deck; the two events it looked at remain (put on the
    // bottom rather than discarded or lost).
    const deck = g.state.player1.deck.map(c => c.cardId);
    expect(deck).toHaveLength(2);
    expect(deck).toContain(Cards.events.sor.momentOfPeace);
    expect(deck).toContain(Cards.events.sor.takedown);
  });

  it("fizzles when no units appear in the top 7", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggw", "rrk", { my: { resourceCount: 7 }, their: {} })
      .WithCardInDeckForPlayer(1, Cards.events.sor.momentOfPeace) // event, not a unit
      .WithCardInHandForPlayer(1, Cards.units.lof.kelleranBeq)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // Only Kelleran Beq in arena — no unit was found to search
    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.lof.kelleranBeq);
  });
});
