import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// SOR_139 — Force Choke (cost 2, Event, Aggression+Villainy, Force)
// If you control a FORCE unit, this event costs [1 resource] less to play.
// Deal 5 damage to a non-VEHICLE unit. That unit's controller draws a card.
//
// "rrk" = red base (Aggression) + Darth Vader (Aggression+Villainy) — no aspect penalty.
// Darth Vader unit (SOR_087) is a Force unit, enabling the discount.

describe("SOR_139 — Force Choke", () => {
  it("deals 5 damage to a chosen non-Vehicle unit", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 2 },
      their: {},
    })
      .WithCardInHandForPlayer(1, Cards.events.sor.forceChoke)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId);
    expect(target?.damage).toBe(5);
  });

  it("that unit's controller draws a card", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 2 },
      their: {},
    })
      .WithCardInHandForPlayer(1, Cards.events.sor.forceChoke)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const targetPlayId = state.player2.groundArena[0].playId;
    const handBefore = g.state.player2.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.hand.length).toBe(handBefore + 1);
  });

  it("costs 1 less when you control a Force unit (costs 1 instead of 2)", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    // Darth Vader unit (Force trait) in play — discount applies
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 1 }, // only 1 resource — without discount can't play (cost 2)
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.darthVaderLeaderUnit)
      .WithCardInHandForPlayer(1, Cards.events.sor.forceChoke)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    // Should succeed with 1 resource (reduced from 2)
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId);
    expect(target?.damage).toBe(5);
  });

  it("costs full 2 resources when you don't control a Force unit", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 1 }, // only 1 resource — can't afford at full cost
      their: {},
    })
      .WithCardInHandForPlayer(1, Cards.events.sor.forceChoke)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("cannot target a Vehicle unit", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", {
      my: { resourceCount: 2 },
      their: {},
    })
      .WithCardInHandForPlayer(1, Cards.events.sor.forceChoke)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.patrollingVWing) // Vehicle
      .Build();
    g.loadNewState(state);
    const vehiclePlayId = state.player2.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vehiclePlayId] });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
