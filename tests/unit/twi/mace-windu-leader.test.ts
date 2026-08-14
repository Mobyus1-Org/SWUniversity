import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_013 Mace Windu — Vaapad Form Master (Leader; deployed 5/8)
//   Leader side: "Action [1 resource, Exhaust]: Deal 1 damage to a damaged enemy unit.
//                 Then, if it has 5 or more damage on it, deal 1 damage to it."
//   Deployed:    "When Deployed: Deal 2 damage to each damaged enemy unit."
//
// Both halves key on DAMAGED enemy units — an undamaged one is never a legal target. The leader
// Action's second point is conditional on the total AFTER the first point lands.

const MARINE = Cards.units.sor.battlefieldMarine;
const WAYFARER = Cards.units.lof.hyperspaceWayfarer; // 4/10 — soaks a lot of damage
const MACE = Cards.leaders.twi.maceWindu;

function setup(resources = 12) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources);
}

describe("TWI_013 Mace Windu", () => {
  describe("leader side — Action [1 resource, Exhaust]", () => {
    it("deals 1 damage to a damaged enemy unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup().MyLeader(MACE)
          .WithSpaceUnitForPlayer(2, WAYFARER, true, 2) // already damaged
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseSpaceUnitAsync(2, 0);

      expect(g.state.player2.spaceArena[0].damage).toBe(3); // 2 + 1
      expect(g.state.player1.leader.ready).toBe(false);
    });

    it("deals a SECOND point when the unit ends up with 5+ damage", async () => {
      const g = new GameTestAdapter();
      // 4 damage + 1 = 5, which meets the "5 or more" check, so a second point lands.
      g.loadNewState(
        setup().MyLeader(MACE)
          .WithSpaceUnitForPlayer(2, WAYFARER, true, 4)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseSpaceUnitAsync(2, 0);

      expect(g.state.player2.spaceArena[0].damage).toBe(6); // 4 +1 then +1
    });

    it("does not deal the second point below the threshold", async () => {
      const g = new GameTestAdapter();
      // 3 + 1 = 4, under 5 — one point only.
      g.loadNewState(
        setup().MyLeader(MACE)
          .WithSpaceUnitForPlayer(2, WAYFARER, true, 3)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.chooseSpaceUnitAsync(2, 0);

      expect(g.state.player2.spaceArena[0].damage).toBe(4);
    });

    it("is unavailable with no DAMAGED enemy unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup().MyLeader(MACE)
          .WithSpaceUnitForPlayer(2, WAYFARER) // undamaged
          .WithGroundUnitForPlayer(1, MARINE, true, 3) // damaged but FRIENDLY
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.ready).toBe(true);
    });
  });

  describe("deployed side — When Deployed", () => {
    it("deals 2 damage to EACH damaged enemy unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(20).MyLeader(MACE)
          .WithSpaceUnitForPlayer(2, WAYFARER, true, 1)
          .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 2)
          .WithGroundUnitForPlayer(2, MARINE) // undamaged — untouched
          .Build(),
      );

      await g.deployLeaderAsync(1);

      expect(g.state.player2.spaceArena[0].damage).toBe(3);
      expect(g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce)!.damage).toBe(4);
      expect(g.state.player2.groundArena.find(u => u.cardId === MARINE)!.damage).toBe(0);
    });

    it("leaves friendly damaged units alone", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(20).MyLeader(MACE)
          .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 2)
          .Build(),
      );

      await g.deployLeaderAsync(1);

      expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce)!.damage).toBe(2);
    });

    // The 2 damage must actually DEFEAT a unit it reduces to 0 HP — the deploy path needs a
    // dead-unit sweep after When Deployed resolves, or the corpse sits in the arena.
    it("defeats a damaged enemy unit the 2 damage finishes off", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(20).MyLeader(MACE)
          .WithGroundUnitForPlayer(2, MARINE, true, 1) // 3 HP, 1 damage → 2 more kills it
          .WithSpaceUnitForPlayer(2, WAYFARER, true, 1) // survives, proves the sweep is selective
          .Build(),
      );

      await g.deployLeaderAsync(1);

      expect(g.state.player2.groundArena.some(u => u.cardId === MARINE)).toBe(false);
      expect(g.state.player2.discard.some(c => c.cardId === MARINE)).toBe(true);
      expect(g.state.player2.spaceArena[0].damage).toBe(3); // still alive
    });
  });

  // The Plot deploy paths resolve When Deployed at different sites than the plain deploy —
  // each needs the same dead-unit sweep.
  describe("deployed side — When Deployed with a Plot window", () => {
    function plotSetup() {
      return setup(20).MyLeader(MACE)
        .FillResourcesForPlayer(1, Cards.units.sec.cadBane, 1) // an affordable Plot resource
        .WithGroundUnitForPlayer(2, MARINE, true, 1); // 3 HP, 1 damage → the 2 kills it
    }

    it("'When Deployed First' still defeats the finished-off unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(plotSetup().Build());

      await g.deployLeaderAsync(1);
      await g.chooseOptionAsync(1, "When Deployed First");

      expect(g.state.player2.groundArena.some(u => u.cardId === MARINE)).toBe(false);
      expect(g.state.player2.discard.some(c => c.cardId === MARINE)).toBe(true);
    });

    it("'Plot First' then passing on the Plot still defeats the finished-off unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(plotSetup().Build());

      await g.deployLeaderAsync(1);
      await g.chooseOptionAsync(1, "Plot First");
      await g.passPlotAsync(1);

      expect(g.state.player2.groundArena.some(u => u.cardId === MARINE)).toBe(false);
      expect(g.state.player2.discard.some(c => c.cardId === MARINE)).toBe(true);
    });
  });
});
