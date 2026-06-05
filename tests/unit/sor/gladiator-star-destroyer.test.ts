import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_086 — Gladiator Star Destroyer (Unit, Space, Command+Villainy, cost 6, 6/5)
// "When Played: Give a unit Sentinel for this phase."
// Uses green base (Command) + Grand Moff Tarkin (Command+Villainy) → no aspect penalty.

describe("SOR_086 — Gladiator Star Destroyer", () => {
  describe("When Played", () => {
    it("prompts to choose a target unit", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.units.sor.gladiatorStarDestroyer)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    });

    it("gives Sentinel to the chosen unit for this phase", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.units.sor.gladiatorStarDestroyer)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const targetPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

      expect(g.state.currentEffects.some(
        e => e.cardId === "SOR_086" && e.targetPlayId === targetPlayId,
      )).toBe(true);
    });

    it("can give Sentinel to a friendly unit", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.units.sor.gladiatorStarDestroyer)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const targetPlayId = state.player1.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

      expect(g.state.currentEffects.some(
        e => e.cardId === "SOR_086" && e.targetPlayId === targetPlayId,
      )).toBe(true);
    });
  });
});
