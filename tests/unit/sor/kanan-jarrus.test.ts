import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_047 Kanan Jarrus — 4/5 Ground Unit (Force, Jedi, Rebel, Spectre)
// On Attack: You may discard 1 card from the defending player's deck for
// each friendly SPECTRE unit. Heal 1 damage from your base for each
// different aspect among the discarded cards.

// Strike True  (SOR_127) aspects: Command
// Darth Vader  (SOR_087) aspects: Command, Villainy
// Battlefield Marine (SOR_095) aspects: Command, Heroism

describe("SOR_047 Kanan Jarrus", () => {
  it("offers discard option when defender deck is non-empty (1 Spectre = 1 card)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [{ cardId: Cards.events.sor.strikeTrue }];

    const enemyPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("does not offer when defender deck is empty", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [];

    const enemyPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // No ability-option — combat resolves immediately
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
  });

  it("declining the ability does not mill or heal", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [{ cardId: Cards.events.sor.strikeTrue }];
    state.player1.base.damage = 10;

    const enemyPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });
    await g.chooseNoAsync(1);

    expect(g.state.player2.deck.length).toBe(1);
    // Kanan takes 2 damage from the Marine during combat, base unchanged from 10
    expect(g.state.player1.base.damage).toBe(10);
  });

  it("mills 1 card (1 distinct aspect) → heals base by 1", async () => {
    // Strike True has aspects: [Command]  → 1 distinct aspect
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [{ cardId: Cards.events.sor.strikeTrue }]; // Command
    state.player1.base.damage = 10;

    const enemyPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });
    await g.chooseYesAsync(1);

    expect(g.state.player2.deck.length).toBe(0);
    expect(g.state.player2.discard.some(c => c.cardId === Cards.events.sor.strikeTrue)).toBe(true);
    expect(g.state.player1.base.damage).toBe(9); // healed by 1 (1 distinct aspect)
  });

  it("mills 1 card (2 distinct aspects) → heals base by 2", async () => {
    // Darth Vader has aspects: [Command, Villainy]  → 2 distinct aspects
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [{ cardId: Cards.units.sor.darthVader }]; // Command, Villainy
    state.player1.base.damage = 10;

    const enemyPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });
    await g.chooseYesAsync(1);

    expect(g.state.player2.deck.length).toBe(0);
    expect(g.state.player1.base.damage).toBe(8); // healed by 2
  });

  it("mills 2 cards when 2 Spectre units in play (Kanan + Chopper)", async () => {
    // 2 Spectres → mill 2 cards; Strike True (Command) + Darth Vader (Command, Villainy)
    // distinct aspects: Command, Villainy → heal 2
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithGroundUnitForPlayer(1, Cards.units.sor.chopper)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [
      { cardId: Cards.units.sor.darthVader }, // Command, Villainy
      { cardId: Cards.events.sor.strikeTrue }, // Command  ← top of deck
    ];
    state.player1.base.damage = 10;

    const enemyPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0); // attack with Kanan (index 0)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });
    await g.chooseYesAsync(1);

    expect(g.state.player2.deck.length).toBe(0);
    // Distinct aspects: Command + Villainy = 2
    expect(g.state.player1.base.damage).toBe(8); // healed by 2
  });

  it("counts each unique aspect only once across all milled cards", async () => {
    // 2 Spectres, mill Strike True (Command) + Battlefield Marine (Command, Heroism)
    // distinct aspects: Command, Heroism → heal 2  (Command only counted once)
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .WithGroundUnitForPlayer(1, Cards.units.sor.chopper)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    state.player2.deck = [
      { cardId: Cards.units.sor.battlefieldMarine }, // Command, Heroism
      { cardId: Cards.events.sor.strikeTrue },        // Command  ← top
    ];
    state.player1.base.damage = 10;

    const enemyPlayId = state.player2.groundArena[0].playId;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });
    await g.chooseYesAsync(1);

    expect(g.state.player2.deck.length).toBe(0);
    // Command deduplicated → distinct aspects: Command, Heroism = 2
    expect(g.state.player1.base.damage).toBe(8); // healed by 2
  });
});
