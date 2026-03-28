import { Unit } from "@/server/engine/unit";
import { PendingResolution, ResolveAttackPending } from "@/server/engine/pending-resolution";
import { GetGame } from "@/server/engine/core-functions";

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
    default:
      return null;
  }
}