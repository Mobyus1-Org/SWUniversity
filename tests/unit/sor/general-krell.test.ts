import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_105 General Krell", () => {
  it("grants draw prompt when a friendly unit is defeated while Krell is in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)  // 1/2 — dies to 3-power counter
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalKrell)       // 4/7 — survives
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // 3/3
      .Build();
    g.loadNewState(state);

    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const marinePlayId = state.player2.groundArena[0].playId;
    const handBefore = g.state.player1.hand.length;

    // Infantry attacks marine; counter deals 3 (>2 HP) → infantry dies
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // Krell's granted ability: "draw a card?"
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(handBefore + 1);
  });

  it("player may decline the draw", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalKrell)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const marinePlayId = state.player2.groundArena[0].playId;
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("does NOT grant draw when Krell is the defeated unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalKrell)       // 4/7
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // 3/3
      .Build();
    g.loadNewState(state);

    // Pre-damage Krell so a 3-power counter will kill him (4 + 3 = 7 = max HP)
    state.player1.groundArena[0].damage = 4;

    const marinePlayId = state.player2.groundArena[0].playId;
    const handBefore = g.state.player1.hand.length;

    // Krell attacks marine; marine counter deals 3 → Krell reaches 7 damage → dies
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // No draw prompt — Krell was the dying unit, not a beneficiary
    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("does NOT grant draw when an enemy unit is defeated", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalKrell)       // 4/7
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // 3/3, no WD ability
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;
    const handBefore = g.state.player1.hand.length;

    // Krell attacks marine; Krell deals 4 (>3 HP) → marine dies, counter deals 3 → Krell survives (4/7)
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // Enemy unit died — no draw prompt, Krell's ability only applies to friendly units
    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("does NOT grant draw when no Krell is in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)   // 1/2 — no Krell in play
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // 3/3
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // No Krell → Vanguard Infantry's own WD fires directly (give XP option)
    // The prompt is NOT the Krell draw — it's infantry's own WD
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1); // skip infantry's own WD (give XP)
    expect(g.state.player1.hand.length).toBe(handBefore); // no draw happened
  });

  it("Krell draw fires first, then unit's own WD fires as continuation", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)  // has own WD: give XP
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalKrell)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const marinePlayId = state.player2.groundArena[0].playId;
    const krellPlayId = state.player1.groundArena[1].playId;
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // 1. Krell's granted draw fires first
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(g.state.player1.hand.length).toBe(handBefore + 1);

    // 2. Infantry's own WD fires as continuation
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [krellPlayId] });

    expect(g.state.player1.groundArena.find(u => u.playId === krellPlayId)
      ?.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });
});
