import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_159 General Grievous — Scourge of Dathomir (8/5 Ground, cost 7, Aggression/Villainy,
// Separatist/Official, unique) —
//   "Bases can't be healed."
//   "When Played: Deal 4 damage to a base."
//
// The first clause is GLOBAL and symmetrical — "bases", not "enemy bases" — so it shuts off
// healing for its own controller too. That is the same rule TWI_132 Confederate Tri-Fighter
// already implements, so this joins that helper rather than adding a parallel one.
//
// The second clause targets "a base", unqualified, so either base is a legal choice.

const GRIEVOUS = "HMW_159";
const REPAIR = Cards.events.sor.repair;            // "Heal 3 damage from a unit or base"
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP, 10)   // pre-damaged so healing is observable
    .MyLeader(Cards.leaders.sor.sabineWren)   // Aggression
    .TheirBase(Cards.bases.common.green30HP, 10)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

describe("HMW_159 General Grievous — Scourge of Dathomir", () => {
  describe("Bases can't be healed", () => {
    it("blocks healing your OWN base while he is in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, GRIEVOUS)
          .WithCardInHandForPlayer(1, REPAIR)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      expect(g.state.player1.base.damage).toBe(10); // unhealed
    });

    it("blocks healing the OPPONENT's base too — the clause is global", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, GRIEVOUS)
          .WithCardInHandForPlayer(1, REPAIR)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

      expect(g.state.player2.base.damage).toBe(10);
    });

    it("blocks it no matter WHOSE side he is on", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(2, GRIEVOUS) // the opponent's Grievous
          .WithCardInHandForPlayer(1, REPAIR)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      expect(g.state.player1.base.damage).toBe(10);
    });

    it("control: without him the base heals normally", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, REPAIR).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      expect(g.state.player1.base.damage).toBe(7); // 10 - 3
    });

    it("stops blocking once he LOSES his abilities", async () => {
      // "Bases can't be healed" is a static ability, so silencing him lifts the lock. The shared
      // helper had no LostAbilities guard before this card, so TWI_132 gains the same fix.
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, GRIEVOUS)
          .WithCardInHandForPlayer(1, REPAIR)
          .Build(),
      );

      const grievous = g.state.player1.groundArena.find(u => u.cardId === GRIEVOUS)!;
      g.state.currentEffects.push({
        cardId: "SOR_138", // Force Lightning — "loses all abilities for this phase"
        duration: "Phase",
        affectedPlayer: 1,
        targetPlayId: grievous.playId,
      });

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      expect(g.state.player1.base.damage).toBe(7); // healed normally
    });

    it("still allows healing a UNIT — only bases are blocked", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, GRIEVOUS)
          .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 5)
          .WithCardInHandForPlayer(1, REPAIR)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      const csfIdx = g.state.player1.groundArena.findIndex(
        u => u.cardId === Cards.units.sor.consularSecurityForce,
      );
      await g.chooseGroundUnitAsync(1, csfIdx);

      expect(g.state.player1.groundArena[csfIdx].damage).toBe(2); // 5 - 3
    });
  });

  describe("When Played: deal 4 damage to a base", () => {
    it("deals 4 to the chosen enemy base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, GRIEVOUS).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

      expect(g.state.player2.base.damage).toBe(14); // 10 + 4
    });

    it("can be aimed at your OWN base — 'a base' is unqualified", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithCardInHandForPlayer(1, GRIEVOUS).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

      expect(g.state.player1.base.damage).toBe(14);
    });
  });
});
