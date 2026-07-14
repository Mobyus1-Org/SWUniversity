import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { OptionText } from "../../test-helpers";

// LOF_260 The Father — Unit (Force), cost 8, 5/10
// "When you use the Force: You may deal 1 damage to this unit. If you do, the Force is with you."
//
// The reaction hangs off the single UseTheForce() choke point, so it fires for ANY card that
// spends the Force token. Tests drive it through several different Force-spenders.

// LOF_172 Sorcerous Blast — "Use the Force. If you do, deal 3 damage to a unit."
// A clean driver: an event with no other entering-play triggers to order against.
function withBlast(fatherController: 1 | 2 = 1) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.events.lof.sorcerousBlast)
    .WithGroundUnitForPlayer(fatherController, Cards.units.lof.theFather)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine); // blast target
}

describe("LOF_260 The Father", () => {
  describe("'When you use the Force: You may deal 1 damage to this unit.'", () => {
    it("prompts after the Force is used", async () => {
      const g = new GameTestAdapter();
      const state = withBlast().Build();
      state.player1.supplemental.forceToken = true;
      g.loadNewState(state);
      const marinePlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0); // Sorcerous Blast
      await g.chooseYesAsync(1); // use the Force
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

      expect(OptionText(g)).toContain("The Father");
      expect(g.state.player1.supplemental.forceToken).toBe(false); // spent, not yet returned
    });

    it("does not prompt when no Force was actually used", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(withBlast().Build()); // no Force token

      await g.playCardFromHandAsync(1, 0);

      const father = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.theFather)!;
      expect(father.damage).toBe(0);
      expect(OptionText(g)).not.toContain("The Father");
    });

    it("does not trigger for the OPPONENT's Force use", async () => {
      const g = new GameTestAdapter();
      // The Father belongs to player 2; player 1 spends the Force.
      const state = withBlast(2).Build();
      state.player1.supplemental.forceToken = true;
      g.loadNewState(state);
      // The Father also sits in player 2's arena here — aim the blast at the Marine.
      const marinePlayId = state.player2.groundArena
        .find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.playId;

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      const father = g.state.player2.groundArena.find(u => u.cardId === Cards.units.lof.theFather)!;
      expect(father.damage).toBe(0); // untouched
    });
  });

  describe("'If you do, the Force is with you.'", () => {
    it("accepting deals 1 damage to The Father and returns the Force token", async () => {
      const g = new GameTestAdapter();
      const state = withBlast().Build();
      state.player1.supplemental.forceToken = true;
      g.loadNewState(state);
      const marinePlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1); // use the Force
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });
      await g.chooseYesAsync(1); // The Father: deal 1 damage to himself

      const father = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.theFather)!;
      expect(father.damage).toBe(1);
      expect(g.state.player1.supplemental.forceToken).toBe(true); // the Force is with you again
    });

    it("declining leaves The Father undamaged and the Force token spent", async () => {
      const g = new GameTestAdapter();
      const state = withBlast().Build();
      state.player1.supplemental.forceToken = true;
      g.loadNewState(state);
      const marinePlayId = state.player2.groundArena[0].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

      // The prompt must really be The Father's, or "No" would be a silent no-op.
      expect(OptionText(g)).toContain("The Father");
      await g.chooseNoAsync(1);

      const father = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.theFather)!;
      expect(father.damage).toBe(0);
      expect(g.state.player1.supplemental.forceToken).toBe(false);
    });
  });

  describe("fires for any Force-spending card (the UseTheForce choke point)", () => {
    it("triggers off Ahsoka Tano's leader Action, which uses the Force", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.ahsokaTano)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithGroundUnitForPlayer(1, Cards.units.lof.theFather)
        .Build();
      state.player1.supplemental.forceToken = true;
      g.loadNewState(state);

      await g.useLeaderAbilityAsync(1);
      expect(g.state.player1.supplemental.forceToken).toBe(false); // Ahsoka spent it

      // Ahsoka's own target prompt (give a friendly unit Sentinel) resolves first, then
      // The Father's reaction drains from the trigger bag.
      const fatherPlayId = state.player1.groundArena[0].playId;
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fatherPlayId] });

      expect(OptionText(g)).toContain("The Father");
      await g.chooseYesAsync(1);

      expect(g.state.player1.groundArena[0].damage).toBe(1);
      expect(g.state.player1.supplemental.forceToken).toBe(true);
    });

    it("triggers off Itinerant Warrior, ordering against its simultaneous Shielded trigger", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 5)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.units.lof.itinerantWarrior)
        .WithGroundUnitForPlayer(1, Cards.units.lof.theFather)
        .Build();
      state.player1.supplemental.forceToken = true;
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1); // use the Force
      await g.chooseBaseAsync(1, 1); // heal own base — the Force is spent here

      // The Warrior's Shielded and The Father's reaction are simultaneous, so the engine asks
      // which to resolve first (CR 7.6).
      expect(OptionText(g)).toContain("Choose which trigger to resolve first");

      await g.chooseOptionAsync(1, "The Father — use-the-force");
      await g.chooseYesAsync(1); // now The Father's own prompt

      const father = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.theFather)!;
      expect(father.damage).toBe(1);
      expect(g.state.player1.supplemental.forceToken).toBe(true);
      expect(g.state.player1.base.damage).toBe(2); // the Warrior's heal still happened (5 - 3)
    });
  });
});
