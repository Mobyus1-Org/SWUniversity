import { Unit } from "@/server/engine/unit";
import { PendingResolution } from "@/server/engine/pending-resolution";
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
    case "SOR_083": { // Superlaser Technician: "When Defeated: You may put this unit into play as a resource and ready it."
      return {
        type: "when-defeated-choice",
        defeatedCardId: unit.cardId,
        defeatedPlayId: unit.playId,
        controlledBy: player,
        options: [`put_into_play_as_resource=${unit.cardId},${player}`, "decline"],
        continuation: null,
      };
    }
    case "SOR_145": { //K-2SO "When Defeated: For each opponent, choose one: either deal 3 damage to that player's base, or that player discards a card from their hand."
      const opponent = player === 1 ? 2 : 1;
      return {
        type: "when-defeated-choice",
        defeatedCardId: unit.cardId,
        defeatedPlayId: unit.playId,
        controlledBy: player,
        options: [`deal_base_damage=${opponent},3`, `player_discards_from_hand=${opponent},1`],
      };
    }
    default:
      return null;
  }
}