import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_150 Heroic Sacrifice", () => {
  it("draws a card immediately when played", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.heroicSacrifice)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // extra card to verify draw count
      .Build();

    // Seed deck with one card so there's something to draw
    state.player1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const handSizeBefore = state.player1.hand.length;

    g.loadNewState(state);
    await g.playCardFromHandAsync(1, 0);

    // Hand size should be handSizeBefore - 1 (played the event) + 1 (drew) = same
    expect(g.state.player1.hand.length).toBe(handSizeBefore);
    expect(g.state.player1.deck.length).toBe(0);
  });

  it("attacking unit gets +2/+0 for the attack", async () => {
    // BFM is 3/3; with +2 it's 5 power. Attacking SPC (4/4) should deal 5 damage (defeating it).
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // 3/3, becomes 5 power
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)   // 4/4
      .WithCardInHandForPlayer(1, Cards.events.sor.heroicSacrifice)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    // Choose BFM as the attacker
    await g.chooseGroundUnitAsync(1, 0);
    // Initiate attack vs the ground Gamorrean Guards
    await g.chooseGroundUnitAsync(2, 0);

    // Gamorrean Guards has 4 HP; BFM dealt 5 damage → defeated
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("attacker is defeated after dealing combat damage to a unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.heroicSacrifice)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Both BFMs are 3/3; attacker deals 5 (3+2) — enemy defeated. Attacker also sacrificed.
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("attacker is defeated after dealing combat damage to the base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.heroicSacrifice)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // BFM dealt 5 damage to enemy base; BFM is then defeated
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("ForAttack power buff does not persist after the attack", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.heroicSacrifice)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // ForAttack effect should be cleared; no SOR_150 effects remain
    expect(g.state.currentEffects.some(e => e.cardId === "SOR_150")).toBe(false);
    expect(g.state.currentEffects.some(e => e.cardId === "SOR_150_sacrifice")).toBe(false);
  });
});
