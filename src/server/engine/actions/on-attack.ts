import { Unit } from "@/server/engine/unit";
import { PendingResolution, ResolveAttackPending } from "@/server/engine/pending-resolution";
import { GetGame, UnitAttackedThisPhase, TraitContains } from "@/server/engine/core-functions";

/**
 * On Attack abilities — called after the attack target is chosen.
 * Returns a PendingResolution if the ability requires player input, or null
 * if no ability triggers for this attacker.
 * The `continuation` is the ResolveAttackPending that executes combat once
 * the on-attack ability finishes resolving.
 */
export function resolveOnAttackTrigger(
  attacker: Unit,
  continuation: ResolveAttackPending,
): PendingResolution | null {
  // Upgrade-granted: Darksaber — give XP to each other friendly Mandalorian (automatic, no player input)
  const hasDarksaber = attacker.upgrades.some(u => u.cardId === "SHD_126");
  if (hasDarksaber) {
    const game = GetGame();
    if (game) {
      const gs = game.currentGameState;
      const player = attacker.controller;
      const friendly = player === 1
        ? [...gs.player1.groundArena, ...gs.player1.spaceArena]
        : [...gs.player2.groundArena, ...gs.player2.spaceArena];
      for (const unit of friendly) {
        if (unit.playId === attacker.playId) continue;
        if (TraitContains(unit.cardId, "Mandalorian", player, unit.playId)) {
          unit.upgrades.push({
            cardId: "SOR_T01",
            playId: String(gs.nextPlayId++),
            owner: player,
            controller: player,
          });
        }
      }
    }
  }

  switch (attacker.cardId) {
    case "SOR_010": { // Darth Vader "On Attack: You may deal 2 damage to a unit."
      const game = GetGame();
      if (!game) return null;
      const gs = game.currentGameState;
      const allUnitPlayIds = [
        ...gs.player1.groundArena,
        ...gs.player1.spaceArena,
        ...gs.player2.groundArena,
        ...gs.player2.spaceArena,
      ].map(u => u.playId);
      return {
        type: "ability-option",
        cardId: "SOR_010",
        helperText: "You may deal 2 damage to a unit.",
        onYes: {
          type: "ability-target",
          cardId: "SOR_010",
          fromPlayIds: allUnitPlayIds,
          continuation,
        },
        continuation,
      };
    }
    case "SOR_014": { // Sabine Wren "On Attack: Deal 1 damage to each enemy base."
      const game = GetGame();
      if (!game) return continuation;
      const gs = game.currentGameState;
      const opponentId = attacker.controller === 1 ? 2 : 1;
      const opponent = opponentId === 1 ? gs.player1 : gs.player2;
      opponent.base.damage += 1;
      return continuation;
    }
    case "SHD_012": { // Bo-Katan Kryze (deployed) "On Attack: You may deal 1 damage to a unit. If you attacked with another Mandalorian unit this phase, you may deal 1 damage to a unit."
      const game = GetGame();
      if (!game) return null;
      const gs = game.currentGameState;
      const allUnitPlayIds = [
        ...gs.player1.groundArena,
        ...gs.player1.spaceArena,
        ...gs.player2.groundArena,
        ...gs.player2.spaceArena,
      ].map(u => u.playId);

      // "another Mandalorian" = a Mandalorian other than Bo-Katan herself
      const anotherMandalorianAttacked = UnitAttackedThisPhase(attacker.controller, "Mandalorian", true, attacker.playId);

      const secondStep: PendingResolution = anotherMandalorianAttacked
        ? {
            type: "ability-option",
            cardId: "SHD_012_2",
            helperText: "You may deal 1 damage to a unit. (Another Mandalorian attacked this phase.)",
            onYes: {
              type: "ability-target",
              cardId: "SHD_012_2",
              player: attacker.controller,
              fromPlayIds: allUnitPlayIds,
              continuation,
            },
            continuation,
          }
        : continuation;

      return {
        type: "ability-option",
        cardId: "SHD_012",
        helperText: "You may deal 1 damage to a unit.",
        onYes: {
          type: "ability-target",
          cardId: "SHD_012_1",
          player: attacker.controller,
          fromPlayIds: allUnitPlayIds,
          continuation: secondStep,
        },
        continuation: secondStep,
      };
    }
    default:
      // If Darksaber fired but no native ability, return continuation so combat proceeds.
      return hasDarksaber ? continuation : null;
  }
}