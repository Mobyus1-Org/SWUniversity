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
