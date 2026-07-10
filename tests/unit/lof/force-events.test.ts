import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_075 Cure Wounds — "Use the Force (lose your Force token). If you do, heal 6 damage from a unit."
// LOF_172 Sorcerous Blast — "Use the Force (lose your Force token). If you do, deal 3 damage to a unit."
// "Use the Force" is a "may" (CR 37.4): prompt when the player controls the Force; the event
// fizzles with no effect when they do not.

describe("LOF_075 Cure Wounds", () => {
  it("uses the Force to heal 6 damage from a chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.events.lof.cureWounds)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 6)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    const woundedPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes"); // Use the Force
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [woundedPlayId] });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("does nothing when the player does not control the Force", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.events.lof.cureWounds)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 6)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0); // the event was actually played
    expect(g.state.player1.groundArena[0].damage).toBe(6); // unchanged
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("declining the Force keeps the token and heals nothing", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.events.lof.cureWounds)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 6)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "No");

    expect(g.state.player1.groundArena[0].damage).toBe(6); // unchanged
    expect(g.state.player1.supplemental.forceToken).toBe(true); // still controls it
  });
});

describe("LOF_172 Sorcerous Blast", () => {
  it("uses the Force to deal 3 damage to a chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3) // Aggression event, off-aspect
      .WithCardInHandForPlayer(1, Cards.events.lof.sorcerousBlast)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 HP, survives 3 damage
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes"); // Use the Force
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("does nothing when the player does not control the Force", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3) // Aggression event, off-aspect
      .WithCardInHandForPlayer(1, Cards.events.lof.sorcerousBlast)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0); // the event was actually played
    expect(g.state.player2.groundArena[0].damage).toBe(0); // unchanged
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
