import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// ─── SOR_228 — Viper Probe Droid ─────────────────────────────────────────────
// When Played: Look at an opponent's hand.  (cost 2, Villainy — "bbk" = Iden Versio)

describe("SOR_228 — Viper Probe Droid", () => {
  it("presents a peek-hand prompt on When Played", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "bbk", "ggw", { my: { resourceCount: 2 }, their: {} })
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.viperProbeDroid)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("PeekHand");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: "PeekHand"; mustDiscard: boolean };
    expect(res.mustDiscard).toBe(false);
  });

  it("dismisses without discarding when player acknowledges", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "bbk", "ggw", { my: { resourceCount: 2 }, their: {} })
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.viperProbeDroid)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    // Opponent's hand unchanged
    expect(g.state.player2.hand.length).toBe(1);
  });
});

// ─── SOR_200 — Spark of Rebellion ───────────────────────────────────────────
// Look at an opponent's hand and discard a card from it.
// Event, cost 2, Cunning+Heroism — "yyw" = Han Solo covers both

describe("SOR_200 — Spark of Rebellion", () => {
  it("presents a peek-hand prompt with mustDiscard", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "yyw", "bbk", { my: { resourceCount: 2 }, their: {} })
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(2, Cards.events.sor.vanquish)
      .WithCardInHandForPlayer(1, Cards.events.sor.sparkOfRebellion)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("PeekHand");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: "PeekHand"; mustDiscard: boolean; eligibleIndices: number[] };
    expect(res.mustDiscard).toBe(true);
    expect(res.eligibleIndices).toEqual([0, 1]); // both cards eligible (any card)
  });

  it("discards the chosen card from opponent's hand", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "yyw", "bbk", { my: { resourceCount: 2 }, their: {} })
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(2, Cards.events.sor.vanquish)
      .WithCardInHandForPlayer(1, Cards.events.sor.sparkOfRebellion)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] }); // discard index 0

    expect(g.state.player2.hand.length).toBe(1);
    expect(g.state.player2.discard.length).toBe(1);
  });

  it("fizzles when opponent's hand is empty", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "yyw", "bbk", { my: { resourceCount: 2 }, their: {} })
      // no cards in opponent's hand
      .WithCardInHandForPlayer(1, Cards.events.sor.sparkOfRebellion)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // No peek prompt — fizzled
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});

// ─── SOR_201 — Bodhi Rook ────────────────────────────────────────────────────
// When Played: Look at an opponent's hand and discard a non-unit card from it.
// Unit, cost 3, Cunning+Cunning — "yyw" gives Cunning+Heroism (1 missing = +2), so cost 5

describe("SOR_201 — Bodhi Rook", () => {
  it("presents peek-hand with non-unit filter", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "yyw", "bbk", { my: { resourceCount: 5 }, their: {} })
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine) // unit — not eligible
      .WithCardInHandForPlayer(2, Cards.events.sor.vanquish)          // event — eligible
      .WithCardInHandForPlayer(1, Cards.units.sor.bodhiRook)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("PeekHand");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: "PeekHand"; mustDiscard: boolean; eligibleIndices: number[] };
    expect(res.mustDiscard).toBe(true);
    expect(res.eligibleIndices).toEqual([1]); // only the event at index 1
  });

  it("discards only the non-unit card", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "yyw", "bbk", { my: { resourceCount: 5 }, their: {} })
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(2, Cards.events.sor.vanquish)
      .WithCardInHandForPlayer(1, Cards.units.sor.bodhiRook)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [1] }); // discard vanquish

    expect(g.state.player2.hand.length).toBe(1);
    expect(g.state.player2.hand[0].cardId).toBe(Cards.units.sor.battlefieldMarine); // unit remains
  });

  it("fizzles when opponent has only units", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "yyw", "bbk", { my: { resourceCount: 5 }, their: {} })
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.bodhiRook)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // Only unit in opponent hand — fizzles
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.hand.length).toBe(1); // unit untouched
  });
});
