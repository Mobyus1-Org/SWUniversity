import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_133 — Seventh Sister (Unit, Ground, Aggression+Villainy, cost 5, 6/3)
// "Saboteur (already implemented)
//  When this unit deals combat damage to an opponent's base: You may deal 3 damage
//  to a ground unit that opponent controls."
// Uses red base (Aggression) + Darth Vader leader (Aggression+Villainy) → no aspect penalty.

describe("SOR_133 — Seventh Sister", () => {
  describe("When deals combat damage to opponent's base", () => {
    it("prompts player to deal 3 damage to an enemy ground unit", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.leiaOrgana)
        .WithGroundUnitForPlayer(1, Cards.units.sor.seventhSister)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2); // attack player 2's base

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    });

    it("deals 3 damage to chosen enemy ground unit when player accepts", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.leiaOrgana)
        .WithGroundUnitForPlayer(1, Cards.units.sor.seventhSister)
        .WithGroundUnitForPlayer(2, Cards.units.sor.steadfastBattalion) // high-HP target
        .Build();
      g.loadNewState(state);

      const targetPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

      expect(g.state.player2.groundArena[0].damage).toBe(3);
    });

    it("skips damage when player declines", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.leiaOrgana)
        .WithGroundUnitForPlayer(1, Cards.units.sor.seventhSister)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.chooseNoAsync(1);

      // battlefieldMarine should be unharmed
      expect(g.state.player2.groundArena[0].damage).toBe(0);
    });

    it("does NOT fire when Seventh Sister attacks a unit (only base attacks)", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.leiaOrgana)
        .WithGroundUnitForPlayer(1, Cards.units.sor.seventhSister)
        .WithGroundUnitForPlayer(2, Cards.units.sor.grandMoffTarkinUnit) // Ground unit, high HP
        .Build();
      g.loadNewState(state);

      const defenderPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

      // After unit attack, no option prompt for Seventh Sister's base-damage ability
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
    });
  });
});
