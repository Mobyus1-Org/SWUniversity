import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_137 — Fallen Lightsaber (Upgrade, Aggression+Villainy, cost 3, +3/+3)
// "Attach to a non-Vehicle unit. (already implemented)
//  If attached unit is a Force unit, it gains:
//  'On Attack: Deal 1 damage to each ground unit the defending player controls.'"
//
// Tests use Obi-Wan Kenobi (SOR_049, Force/Jedi/Rebel, no Saboteur, no innate On Attack).
// Uses WithUpgradesOnGroundUnitForPlayer to pre-attach (same pattern as jedi-lightsaber.test.ts).
// reinforcementWalker (SOR_119, ~5/9 Ground) is used as a high-HP target that survives combat.

describe("SOR_137 — Fallen Lightsaber", () => {
  describe("On Attack — conditional Force unit ability", () => {
    it("deals 1 damage to a non-targeted enemy ground unit when attached to a Force unit", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.leiaOrgana)
        .WithGroundUnitForPlayer(1, Cards.units.sor.obiWanKenobi) // Force unit
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.sor.fallenLightsaber, 1),
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // attack target
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // bystander — takes 1 from saber
        .Build();
      g.loadNewState(state);

      const walkerPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

      // Both enemy ground units take 1 damage from Fallen Lightsaber's on-attack
      expect(g.state.player2.groundArena[1].damage).toBe(1);
    });

    it("bystander enemy ground unit takes exactly 1 damage (not combat damage)", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.leiaOrgana)
        .WithGroundUnitForPlayer(1, Cards.units.sor.obiWanKenobi)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.sor.fallenLightsaber, 1),
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // target
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // bystander
        .Build();
      g.loadNewState(state);

      const walkerPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

      // Bystander (not the attack target) takes exactly 1 damage — only from the lightsaber
      expect(g.state.player2.groundArena[1].damage).toBe(1);
    });

    it("does NOT fire when attached to a non-Force unit", async () => {
      // battlefieldMarine (3/3, NOT Force) + Fallen Lightsaber (+3/+3) = 6/6.
      // No saber on-attack. Walker (5/9) takes 6 combat damage only.
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.leiaOrgana)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // NOT Force
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.sor.fallenLightsaber, 1),
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // target
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // bystander — should take 0 damage
        .Build();
      g.loadNewState(state);

      const walkerPlayId = state.player2.groundArena[0].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

      // Bystander walker takes 0 damage — lightsaber on-attack did NOT fire (non-Force bearer)
      expect(g.state.player2.groundArena[1].damage).toBe(0);
    });
  });
});
