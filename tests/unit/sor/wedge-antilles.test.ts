import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_100 — Wedge Antilles (Unit, Ground, Command+Heroism, cost 5, 5/5, Rebel)
// "Each friendly VEHICLE unit gets +1/+1 and gains Ambush."
// Ambush for Vehicle units is already implemented.
// This tests the missing +1/+1 stat buff.
// Uses green base (Command) + Leia Organa (Command+Heroism) → no aspect penalty.
// rogueSquadronSkirmisher (SOR_101) is a Ground Vehicle Speeder, base power = 4.

describe("SOR_100 — Wedge Antilles", () => {
  describe("+1/+1 buff to friendly VEHICLE units", () => {
    it("friendly Vehicle unit attacks base for base+1 damage when Wedge is in play", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wedgeAntillesSor)
        .WithGroundUnitForPlayer(1, Cards.units.sor.rogueSquadronSkirmisher) // Vehicle, base power = 4
        .Build();
      g.loadNewState(state);

      await g.attackWithGroundUnitAsync(1, 1); // rogue attacks
      await g.chooseBaseAsync(1, 2); // attack player 2's base

      // With Wedge, rogue has base power 4 + 1 = 5 damage to base
      expect(g.state.player2.base.damage).toBe(5);
    });

    it("non-Vehicle unit does not get buffed when Wedge is in play", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wedgeAntillesSor)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel Trooper, NOT a Vehicle
        .Build();
      g.loadNewState(state);

      await g.attackWithGroundUnitAsync(1, 1); // battlefieldMarine (3 power) attacks base
      await g.chooseBaseAsync(1, 2);

      // BattlefieldMarine has 3 base power — no buff from Wedge since it's not a Vehicle
      expect(g.state.player2.base.damage).toBe(3);
    });

    it("enemy Vehicle unit does not get buffed by opponent's Wedge", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wedgeAntillesSor) // player 1's Wedge
        .WithGroundUnitForPlayer(2, Cards.units.sor.rogueSquadronSkirmisher) // enemy Vehicle
        .WithActivePlayer(2)
        .Build();
      g.loadNewState(state);

      await g.attackWithGroundUnitAsync(2, 0); // enemy rogue attacks
      await g.chooseBaseAsync(2, 1); // attack player 1's base

      // Enemy rogue has base power 4 only — not buffed by player 1's Wedge
      expect(g.state.player1.base.damage).toBe(4);
    });
  });
});
