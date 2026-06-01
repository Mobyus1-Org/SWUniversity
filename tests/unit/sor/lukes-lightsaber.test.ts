import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_053 Luke's Lightsaber — Upgrade (Vigilance+Heroism), cost 3
// "Attach to a non-Vehicle unit. When Played: If attached unit is Luke Skywalker, heal all damage from him and give a Shield token to him."

describe("SOR_053 Luke's Lightsaber", () => {
  it("heals all damage and gives Shield when attached to Luke Skywalker", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance+Heroism covers both aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.lukesLightsaber)
      .WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker, true, 3) // damaged Luke
      .Build();
    g.loadNewState(state);

    const lukePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [lukePlayId] });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T02")).toBe(true);
  });

  it("does nothing extra when attached to a non-Luke unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)    // Vigilance+Heroism
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.lukesLightsaber)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // damaged non-Luke
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player1.groundArena[0].damage).toBe(2); // unchanged
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T02")).toBe(false);
  });
});
