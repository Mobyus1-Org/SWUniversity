import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// SOR_109 — Colonel Yularen (cost 2, 2/3, Ground, Command, Imperial/Official, Unique)
// When you play a [Command] unit (including this one): Heal 1 damage from your base.
//
// "ggk" = Command Center base + Grand Moff Tarkin — both provide Command, no penalty for Command cards.
// Vanguard Infantry (SOR_108, Command only, cost 1) used as the trigger unit — no when-played ability.

describe("SOR_109 — Colonel Yularen", () => {
  it("heals 1 from your base when Yularen himself is played", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggk", "rrw", {
      my: { baseDamage: 5, resourceCount: 2 },
      their: {},
    })
      .WithCardInHandForPlayer(1, Cards.units.sor.vanguardInfantry)
      .WithCardInHandForPlayer(1, Cards.units.sor.colonelYularen)
      .Build();
    g.loadNewState(state);

    // Play Yularen (index 1 in hand)
    await g.playCardFromHandAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(4);
  });

  it("heals 1 from your base when another Command unit is played while Yularen is in play", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggk", "rrw", {
      my: { baseDamage: 5, resourceCount: 1 },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.colonelYularen)
      .WithCardInHandForPlayer(1, Cards.units.sor.vanguardInfantry)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(4);
  });

  it("heals 1 per Command unit played (two Command units = two heals)", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggk", "rrw", {
      my: { baseDamage: 6, resourceCount: 2 },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.colonelYularen)
      .WithCardInHandForPlayer(1, Cards.units.sor.vanguardInfantry)
      .WithCardInHandForPlayer(1, Cards.units.sor.vanguardInfantry)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(4);
  });

  it("does not heal when opponent plays a Command unit", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggk", "ggk", {
      my: {},
      their: { resourceCount: 1 },
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.colonelYularen)
      .WithCardInHandForPlayer(2, Cards.units.sor.vanguardInfantry)
      .Build();
    g.loadNewState(state);
    state.player1.base.damage = 5;

    await g.playCardFromHandAsync(2, 0);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("does not heal when a non-Command unit is played while Yularen is in play", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    // Death Trooper (SOR_033) has Aggression+Villainy — no Command
    const state = CommonSetup(gsb, "rrk", "ggk", {
      my: { baseDamage: 5, resourceCount: 1 },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.colonelYularen)
      .WithCardInHandForPlayer(1, Cards.units.sor.deathTrooper)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("does not heal when Yularen has lost abilities", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggk", "rrw", {
      my: { baseDamage: 5, resourceCount: 1 },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.colonelYularen)
      .WithCardInHandForPlayer(1, Cards.units.sor.vanguardInfantry)
      .Build();
    g.loadNewState(state);
    const yularenPlayId = state.player1.groundArena[0].playId;
    state.currentEffects.push({ cardId: "SOR_138", duration: "Phase", affectedPlayer: 1, targetPlayId: yularenPlayId });

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(5);
  });
});
