import { Unit } from "../unit";
import { PendingResolution } from "../pending-resolution";
import { PlayerId } from "@/lib/engine/core-models";

/**
 * When Defeated abilities — called immediately after the unit is removed from
 * play and placed in the discard.
 */
export function resolveWhenDefeated(
  unit: Unit,
  player: PlayerId
): PendingResolution | null {
  switch (unit.cardId) {
    case "SOR_145": //K-2SO "When Defeated: For each opponent, choose one: either deal 3 damage to that player's base, or that player discards a card from their hand."
      return {
        type: "when-defeated-choice",
        defeatedCardId: unit.cardId,
        defeatedPlayId: unit.playId,
        controlledBy: player,
      };
    default:
      return null;
  }
}