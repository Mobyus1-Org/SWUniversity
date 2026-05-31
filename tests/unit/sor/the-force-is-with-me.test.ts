import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_055 — The Force Is With Me (Event, cost 4, Vigilance+Heroism)
// Choose a friendly unit and give 2 Experience tokens to it.
// If you control a FORCE unit, also give a Shield token to the chosen unit.
// You may attack with the chosen unit.
//
// Chirrut Imwe leader (SOR_004, Vigilance+Heroism) covers the aspect — no penalty.
// Kanan Jarrus (SOR_047) is a Force unit (Force,Jedi,Rebel,Spectre).

describe("SOR_055 The Force Is With Me", () => {
  it("single non-Force unit: gets 2 XP, no shield, attack option offered", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.theForceIsWithMe)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena[0];
    const xpCount = marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience).length;
    const shieldCount = marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield).length;
    expect(xpCount).toBe(2);
    expect(shieldCount).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("single Force unit: gets 2 XP, gets shield, attack option offered", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.theForceIsWithMe)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .Build();
    g.loadNewState(state);
    const kananPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [kananPlayId] });

    const kanan = g.state.player1.groundArena[0];
    const xpCount = kanan.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience).length;
    const shieldCount = kanan.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield).length;
    expect(xpCount).toBe(2);
    expect(shieldCount).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("Force unit in play, choosing the non-Force unit: gets 2 XP + shield", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.theForceIsWithMe)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena[0];
    const xpCount = marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience).length;
    const shieldCount = marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield).length;
    expect(xpCount).toBe(2);
    expect(shieldCount).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("Force unit in play, choosing the Force unit: gets 2 XP + shield", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.theForceIsWithMe)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .Build();
    g.loadNewState(state);
    const kananPlayId = state.player1.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [kananPlayId] });

    const kanan = g.state.player1.groundArena[1];
    const xpCount = kanan.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience).length;
    const shieldCount = kanan.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield).length;
    expect(xpCount).toBe(2);
    expect(shieldCount).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });
});
