import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_017 Chancellor Palpatine // Darth Sidious — "Playing Both Sides" ("Flipatine").
//
// The only card whose second side is another LEADER rather than a leader unit, so it has no
// cost/power/HP and can never deploy. It flips between two faces instead:
//
//   Chancellor (front): "Action [Exhaust]: If a friendly Heroism unit was defeated this phase,
//                        draw a card, heal 2 damage from your base, then flip this leader."
//   Sidious (back):     "Action [Exhaust]: If you played a Villainy card this phase, create a
//                        Clone Trooper token, deal 2 damage to each enemy base, then flip this
//                        leader."
//
// Both conditions are ASPECT-based (Heroism / Villainy), not trait-based. Per the engine's
// soft-pass convention the Action stays usable with its condition unmet — it exhausts and does
// nothing, and crucially does NOT flip, because the flip sits inside the "if" clause.

const MARINE = Cards.units.sor.battlefieldMarine;          // Command/Heroism
const CSF = Cards.units.sor.consularSecurityForce;         // Vigilance — no Heroism
const CLONE_TROOPER = Cards.units.token.cloneTrooper;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5) // pre-damaged so healing is observable
    .MyLeader(Cards.leaders.twi.chancellorPalpatine)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInDeckForPlayer(1, CSF);
}

describe("TWI_017 Chancellor Palpatine // Darth Sidious", () => {
  describe("structure — it has no unit side", () => {
    it("cannot be deployed", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().Build());

      await g.deployLeaderAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.deployed).toBe(false);
      expect(g.state.player1.groundArena).toHaveLength(0);
      expect(g.state.player1.spaceArena).toHaveLength(0);
    });

    it("starts on the Chancellor side", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().Build());
      expect(g.state.player1.leader.flipped ?? false).toBe(false);
    });
  });

  describe("Chancellor side — friendly Heroism unit defeated", () => {
    function withDefeatedHeroismUnit() {
      // Battlefield Marine (Command/Heroism) dies to the 3-power Consular Security Force.
      return setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF);
    }

    it("draws a card, heals 2 from your base, and flips to Sidious", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(withDefeatedHeroismUnit().Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0); // the Marine trades and dies
      expect(g.state.player1.groundArena).toHaveLength(0);

      const handBefore = g.state.player1.hand.length;
      const deckBefore = g.state.player1.deck.length;
      await g.dispatchAsync(2, "pass-action", {});
      await g.useLeaderAbilityAsync(1);

      expect(g.state.player1.hand).toHaveLength(handBefore + 1);
      expect(g.state.player1.deck).toHaveLength(deckBefore - 1);
      expect(g.state.player1.base.damage).toBe(3); // 5 - 2
      expect(g.state.player1.leader.flipped).toBe(true);
      expect(g.state.player1.leader.ready).toBe(false); // Action [Exhaust]
    });

    it("does nothing and does NOT flip when no Heroism unit was defeated", async () => {
      const g = new GameTestAdapter();
      // A non-Heroism friendly unit dies instead.
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, CSF)
          .WithGroundUnitForPlayer(2, Cards.units.lof.oggdoBogdo)
          .Build(),
      );
      const handBefore = g.state.player1.hand.length;

      await g.useLeaderAbilityAsync(1);

      expect(g.state.player1.hand).toHaveLength(handBefore);
      expect(g.state.player1.base.damage).toBe(5); // unhealed
      expect(g.state.player1.leader.flipped ?? false).toBe(false);
      expect(g.state.player1.leader.ready).toBe(false); // still spends the Exhaust cost
    });

    it("an ENEMY Heroism unit dying does not satisfy 'friendly'", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, CSF)
          .WithGroundUnitForPlayer(2, MARINE) // enemy Heroism unit
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0); // the enemy Marine dies
      expect(g.state.player2.groundArena).toHaveLength(0);

      await g.dispatchAsync(2, "pass-action", {});
      await g.useLeaderAbilityAsync(1);

      expect(g.state.player1.leader.flipped ?? false).toBe(false);
      expect(g.state.player1.base.damage).toBe(5);
    });
  });

  describe("Sidious side — Villainy card played", () => {
    function flippedSetup() {
      return setup().MyLeaderFlipped();
    }

    it("creates a Clone Trooper, deals 2 to each enemy base, and flips back", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        flippedSetup()
          .WithCardInHandForPlayer(1, Cards.units.sor.tieLnFighter) // Villainy, cost 1
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0); // play a Villainy card this phase
      await g.dispatchAsync(2, "pass-action", {});
      await g.useLeaderAbilityAsync(1);

      expect(g.state.player1.groundArena.some(u => u.cardId === CLONE_TROOPER)).toBe(true);
      expect(g.state.player2.base.damage).toBe(2);
      expect(g.state.player1.leader.flipped).toBe(false); // flipped back to Chancellor
    });

    it("does nothing and does NOT flip without a Villainy card played", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(flippedSetup().Build());

      await g.useLeaderAbilityAsync(1);

      expect(g.state.player1.groundArena).toHaveLength(0);
      expect(g.state.player2.base.damage).toBe(0);
      expect(g.state.player1.leader.flipped).toBe(true); // still Sidious
      expect(g.state.player1.leader.ready).toBe(false);
    });
  });

  describe("the flipped side is Darth Sidious, not Chancellor Palpatine", () => {
    it("reports the back-side title and traits while flipped", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().MyLeaderFlipped().Build());

      expect(g.state.player1.leader.flipped).toBe(true);
      // Sidious is Force/Separatist/Sith — the front's Republic/Official must not apply.
      const { LeaderSideTraits, LeaderSideTitle } = await import("@/server/engine/core-functions");
      expect(LeaderSideTitle(Cards.leaders.twi.chancellorPalpatine, true)).toBe("Darth Sidious");
      expect(LeaderSideTraits(Cards.leaders.twi.chancellorPalpatine, true)).toContain("Sith");
      expect(LeaderSideTraits(Cards.leaders.twi.chancellorPalpatine, true)).not.toContain("Republic");
      expect(LeaderSideTitle(Cards.leaders.twi.chancellorPalpatine, false)).toBe("Chancellor Palpatine");
      expect(LeaderSideTraits(Cards.leaders.twi.chancellorPalpatine, false)).toContain("Republic");
    });

    it("trait lookups follow the showing face", async () => {
      const { TraitContains } = await import("@/server/engine/core-functions");
      const PALPATINE = Cards.leaders.twi.chancellorPalpatine;

      const front = new GameTestAdapter();
      front.loadNewState(setup().Build());
      expect(TraitContains(PALPATINE, "Republic", 1)).toBe(true);
      expect(TraitContains(PALPATINE, "Sith", 1)).toBe(false);

      const back = new GameTestAdapter();
      back.loadNewState(setup().MyLeaderFlipped().Build());
      expect(TraitContains(PALPATINE, "Sith", 1)).toBe(true);
      expect(TraitContains(PALPATINE, "Separatist", 1)).toBe(true);
      // The front's traits must not leak through once flipped.
      expect(TraitContains(PALPATINE, "Republic", 1)).toBe(false);
    });
  });
});
