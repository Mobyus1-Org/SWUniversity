import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_049 Obi-Wan Kenobi (Following Fate) — 3/5 Ground (Heroism), cost 6
// "Sentinel. When Defeated: Give 2 Experience tokens to another friendly unit. If it's a Force unit, draw a card."

describe("SOR_049 Obi-Wan Kenobi", () => {
  it("gives 2 XP tokens to the chosen friendly unit when defeated", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt) // 9 power > 5 HP — kills Obi, no On Attack
      .WithGroundUnitForPlayer(2, Cards.units.sor.obiWanKenobi)        // 3/5 sentinel
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)   // XP target
      .Build();
    g.loadNewState(state);

    const obiPlayId = state.player2.groundArena[0].playId;
    const marinePlayId = state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [obiPlayId] });

    // Obi-Wan's WD fires: choose a friendly unit for XP
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player2.groundArena[0];
    expect(marine.upgrades.filter(u => u.cardId === "SOR_T01").length).toBe(2);
  });

  it("also draws a card if the chosen unit is a Force unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker)
      .WithGroundUnitForPlayer(2, Cards.units.sor.obiWanKenobi)
      .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce) // Force aspect unit
      .Build();
    g.loadNewState(state);

    state.player2.deck.push({ cardId: Cards.units.sor.battlefieldMarine });

    const obiPlayId = state.player2.groundArena[0].playId;
    const forcePlayId = state.player2.groundArena[1].playId;
    const handBefore = g.state.player2.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [obiPlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [forcePlayId] });

    expect(g.state.player2.hand.length).toBe(handBefore + 1);
  });

  it("does not draw a card if the chosen unit is not a Force unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker)
      .WithGroundUnitForPlayer(2, Cards.units.sor.obiWanKenobi)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // not Force
      .Build();
    g.loadNewState(state);

    state.player2.deck.push({ cardId: Cards.units.sor.battlefieldMarine });

    const obiPlayId = state.player2.groundArena[0].playId;
    const marinePlayId = state.player2.groundArena[1].playId;
    const handBefore = g.state.player2.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [obiPlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player2.hand.length).toBe(handBefore);
  });
});
