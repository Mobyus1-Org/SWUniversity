import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// LAW_045 Zeb Orellios (Spectre Four) — 4/5 Ground, Vigilance/Aggression/Heroism, cost 5.
// "Sentinel
//  When Played: You may deal 3 damage to a ground unit. If you control a Command or
//  Cunning unit, you may deal 5 damage to a ground unit instead."
describe("LAW_045 Zeb Orellios", () => {
  it("has Sentinel", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.law.zebOrellios)
      .Build();
    g.loadNewState(state);

    const zeb = g.state.player1.groundArena[0];
    expect(HasSentinel(zeb.cardId, zeb.playId, 1)).toBe(true);
  });

  describe("When Played", () => {
    it("deals 3 damage to a chosen ground unit with no Command/Cunning unit controlled", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 11)
        .WithCardInHandForPlayer(1, Cards.units.law.zebOrellios)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 9 HP survivor
        .Build();
      g.loadNewState(state);

      const targetPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

      expect(g.state.player2.groundArena[0].damage).toBe(3);
    });

    it("deals 5 damage instead when you control a Command or Cunning unit", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 11)
        .WithGroundUnitForPlayer(1, Cards.units.sec.gnkPowerDroid) // SEC_110, Command
        .WithCardInHandForPlayer(1, Cards.units.law.zebOrellios)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 9 HP survivor
        .Build();
      g.loadNewState(state);

      const targetPlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

      expect(g.state.player2.groundArena[0].damage).toBe(5);
    });

    it("deals no damage when declined", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 11)
        .WithCardInHandForPlayer(1, Cards.units.law.zebOrellios)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1);

      expect(g.state.player2.groundArena[0].damage).toBe(0);
    });
  });
});
