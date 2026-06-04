import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// SOR_129 — Admiral Ozzel (cost 2, 2/3, Ground, Aggression+Villainy, Imperial/Official, Unique)
// Action [exhaust]: Play an Imperial unit from your hand (paying its cost).
//   It enters play ready. Each opponent may ready a unit.
//
// "rrk" = red base (Aggression) + Darth Vader (Aggression+Villainy) — covers both aspects, no penalty.
// Death Star Stormtrooper (SOR_128): cost 1, Imperial, Aggression+Villainy, no when-played.

describe("SOR_129 — Admiral Ozzel", () => {
  it("plays an Imperial unit from hand for its normal cost and it enters ready", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 1 },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.admiralOzzel)
      .WithCardInHandForPlayer(1, Cards.units.sor.deathStarStormtrooper)
      .Build();
    g.loadNewState(state);
    const ozzelPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.admiralOzzel, playId: ozzelPlayId });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    // Opponent may ready a unit — choose No (no units in play)
    await g.chooseNoAsync(2);

    // Stormtrooper should be in play and READY
    const trooper = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.deathStarStormtrooper);
    expect(trooper).toBeDefined();
    expect(trooper?.ready).toBe(true);
    // Ozzel should be exhausted
    const ozzel = g.state.player1.groundArena.find(u => u.playId === ozzelPlayId);
    expect(ozzel?.ready).toBe(false);
  });

  it("exhausts Ozzel as the action cost (no resource cost for the ability itself)", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 1 },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.admiralOzzel)
      .WithCardInHandForPlayer(1, Cards.units.sor.deathStarStormtrooper)
      .Build();
    g.loadNewState(state);
    const ozzelPlayId = state.player1.groundArena[0].playId;
    const resourcesBefore = g.state.player1.resources.filter(r => r.ready).length;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.admiralOzzel, playId: ozzelPlayId });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    await g.chooseNoAsync(2);

    // Resources should decrease only by the unit's cost (1 for Stormtrooper)
    const resourcesAfter = g.state.player1.resources.filter(r => r.ready).length;
    expect(resourcesAfter).toBe(resourcesBefore - 1);
  });

  it("opponent may choose to ready one of their exhausted units", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 1 },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.admiralOzzel)
      .WithCardInHandForPlayer(1, Cards.units.sor.deathStarStormtrooper)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, false) // exhausted
      .Build();
    g.loadNewState(state);
    const ozzelPlayId = state.player1.groundArena[0].playId;
    const marinePlayId = state.player2.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.admiralOzzel, playId: ozzelPlayId });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    // Opponent chooses to ready a unit
    await g.chooseYesAsync(2);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player2.groundArena.find(u => u.playId === marinePlayId);
    expect(marine?.ready).toBe(true);
  });

  it("cannot play a non-Imperial unit", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 2 },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.admiralOzzel)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const ozzelPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.admiralOzzel, playId: ozzelPlayId });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("ability is unavailable when Ozzel has no Imperial units in hand", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: {},
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.admiralOzzel)
      .Build();
    g.loadNewState(state);
    const ozzelPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.admiralOzzel, playId: ozzelPlayId });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
