import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_188 Chopper — Cost 1, 1/1, Ground, Cunning+Heroism, Rebel+Droid+Spectre
// While you control another SPECTRE unit, this unit gains Raid 1.
// On Attack: Discard a card from the defending player's deck.
//   If it's an event, exhaust a resource that player controls.

describe("SOR_188 Chopper", () => {
  describe("Conditional Raid 1", () => {
    it("gains Raid 1 when another SPECTRE unit is in play", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla) // Command+Heroism; pay +2 for Cunning
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.chopper)
        .WithGroundUnitForPlayer(1, Cards.units.sor.zebOrrelios) // another Spectre
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;
      await g.attackWithGroundUnitAsync(1, 0); // Chopper attacks
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      // Chopper (1 power) + Raid 1 = 2 damage; battlefieldMarine has 3 HP so survives
      expect(g.state.player2.groundArena[0].damage).toBe(2);
    });

    it("has no Raid 1 without another SPECTRE unit", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.chopper) // only Spectre
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;
      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      // Chopper 1 power, no Raid = 1 damage
      expect(g.state.player2.groundArena[0].damage).toBe(1);
    });
  });

  describe("On Attack: mill 1 from defender's deck", () => {
    it("discards 1 card from the defending player's deck on attack", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine) // non-event top card
        .WithGroundUnitForPlayer(1, Cards.units.sor.chopper)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;
      const deckBefore = g.state.player2.deck.length;
      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      expect(g.state.player2.deck.length).toBe(deckBefore - 1);
      expect(g.state.player2.discard.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    });

    it("exhausts a resource from defender's hand when the milled card is an event", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 2) // player 2 has 2 ready resources
        .WithCardInDeckForPlayer(2, Cards.events.sor.waylay) // TRICK event on top
        .WithGroundUnitForPlayer(1, Cards.units.sor.chopper)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;
      const readyBefore = g.state.player2.resources.filter(r => r.ready).length;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      expect(g.state.player2.resources.filter(r => r.ready).length).toBe(readyBefore - 1);
    });

    it("does not exhaust a resource when the milled card is not an event", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine) // non-event
        .WithGroundUnitForPlayer(1, Cards.units.sor.chopper)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      const enemyPlayId = state.player2.groundArena[0].playId;
      const readyBefore = g.state.player2.resources.filter(r => r.ready).length;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

      expect(g.state.player2.resources.filter(r => r.ready).length).toBe(readyBefore);
    });
  });
});
