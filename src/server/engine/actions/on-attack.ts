import { Unit } from "../unit";
import { PendingResolution } from "../pending-resolution";

/**
 * On Attack abilities — checked before the attack target is asked for.
 * Return an AbilityOptionPending (optional) or AbilityTargetPending (mandatory
 * with target) if the ability must be handled, or null to skip straight to
 * target selection.
 */
export function resolveOnAttack(
  attacker: Unit
): PendingResolution | null {
  switch (attacker.cardId) {
    case "SOR_014": //Sabine Wren "On Attack: Deal 1 damage to each enemy base."
      return null; // not sure here. still need to figure out where abilities actually resolve and change gamestate
    default:
      return null;
  }
}