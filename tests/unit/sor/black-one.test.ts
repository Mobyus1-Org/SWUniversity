import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_147 Black One — 4/4 Space (Scourge of Starkiller Base), cost 6
// "When Played/When Defeated: You may discard your hand. If you do, draw 3 cards."

describe("SOR_147 Black One", () => {
  describe("When Played", () => {
    it("offers Yes/No choice on play", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.units.sor.blackOne)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    });

    it("choosing Yes discards hand and draws 3", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.units.sor.blackOne)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);
      state.player1.deck = [
        { cardId: Cards.units.sor.battlefieldMarine },
        { cardId: Cards.units.sor.battlefieldMarine },
        { cardId: Cards.units.sor.battlefieldMarine },
      ];

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);

      expect(g.state.player1.hand.length).toBe(3); // 3 drawn, old cards discarded
      expect(g.state.player1.discard.some(d => d.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    });

    it("choosing No leaves hand unchanged", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.units.sor.blackOne)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1);

      expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    });
  });

  describe("When Defeated", () => {
    it("offers Yes/No choice when Black One is defeated", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.blackOne)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.infernoFour)
        .WithActivePlayer(2)
        .Build();
      g.loadNewState(state);
      // Pre-damage Black One so infernoFour (2 power) can finish it
      state.player1.spaceArena[0].damage = 3;
      const blackOnePlayId = state.player1.spaceArena[0].playId;

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: [blackOnePlayId] });

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    });

    it("choosing Yes on defeat discards hand and draws 3", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.blackOne)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.infernoFour)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(2)
        .Build();
      g.loadNewState(state);
      state.player1.spaceArena[0].damage = 3;
      state.player1.deck = [
        { cardId: Cards.units.sor.battlefieldMarine },
        { cardId: Cards.units.sor.battlefieldMarine },
        { cardId: Cards.units.sor.battlefieldMarine },
      ];
      const blackOnePlayId = state.player1.spaceArena[0].playId;

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: [blackOnePlayId] });
      await g.chooseYesAsync(1);

      expect(g.state.player1.hand.length).toBe(3);
    });
  });
});
