import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_143 — Fighters for Freedom (Unit, Ground, Aggression+Heroism, cost 3, 4/3, Rebel Trooper)
// "Saboteur (already implemented)
//  When you play another [Aggression] card: You may deal 1 damage to a base."
// Uses red base (Aggression) + Sabine Wren leader (Aggression+Heroism) → no aspect penalty.
// ardentSympathizer (SOR_161) is Aggression aspect and has no WhenPlayed interaction.

describe("SOR_143 — Fighters for Freedom", () => {
  describe("When another Aggression card is played", () => {
    it("prompts to deal 1 damage to a base when an Aggression unit is played", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithGroundUnitForPlayer(1, Cards.units.sor.fightersForFreedom)
        .WithCardInHandForPlayer(1, Cards.units.sor.ardentSympathizer)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    });

    it("deals 1 damage to chosen opponent base when player accepts", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithGroundUnitForPlayer(1, Cards.units.sor.fightersForFreedom)
        .WithCardInHandForPlayer(1, Cards.units.sor.ardentSympathizer)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

      expect(g.state.player2.base.damage).toBe(1);
    });

    it("can also deal 1 damage to own base", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithGroundUnitForPlayer(1, Cards.units.sor.fightersForFreedom)
        .WithCardInHandForPlayer(1, Cards.units.sor.ardentSympathizer)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      expect(g.state.player1.base.damage).toBe(1);
    });

    it("skips damage when player declines", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithGroundUnitForPlayer(1, Cards.units.sor.fightersForFreedom)
        .WithCardInHandForPlayer(1, Cards.units.sor.ardentSympathizer)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1);

      expect(g.state.player1.base.damage).toBe(0);
      expect(g.state.player2.base.damage).toBe(0);
    });

    it("does NOT trigger when a non-Aggression card is played", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithGroundUnitForPlayer(1, Cards.units.sor.fightersForFreedom)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // Command+Heroism, NOT Aggression
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      // No option prompt — no Aggression card was played
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
    });
  });
});
