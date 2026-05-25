import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_080 / SHD_081 General Tagge", () => {
  it("When Played: gives Experience to each chosen Trooper (up to 3)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.generalTagge)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .Build();
    g.loadNewState(state);

    const trooper1 = state.player1.groundArena[0].playId;
    const trooper2 = state.player1.groundArena[1].playId;
    const trooper3 = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);

    // WP prompt: choose up to 3 Trooper units
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trooper1, trooper2, trooper3] });

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
    expect(g.state.player1.groundArena[1].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
    expect(g.state.player2.groundArena[0].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });

  it("When Played: player may choose fewer than 3 Troopers", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry)
      .WithCardInHandForPlayer(1, Cards.units.sor.generalTagge)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .Build();
    g.loadNewState(state);

    const trooper1 = state.player1.groundArena[0].playId;
    const trooper2 = state.player1.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trooper1] });

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
    expect(g.state.player1.groundArena[1].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(false);
    // Tagge itself enters play (not a Trooper, so no XP)
    const tagge = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.generalTagge);
    expect(tagge?.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(false);

    // Trooper 2 not chosen — no XP
    const p1Units = g.state.player1.groundArena;
    const t2Unit = p1Units.find(u => u.playId === trooper2);
    expect(t2Unit?.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(false);
  });

  it("When Played: does nothing when no Troopers are in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInHandForPlayer(1, Cards.units.sor.generalTagge)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // No Troopers — no prompt, just enters play
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.generalTagge)).toBe(true);
  });

  it("SHD_081 reprint behaves identically", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.shd.generalTagge)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .Build();
    g.loadNewState(state);

    const trooper = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trooper] });

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });
});
