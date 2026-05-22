import { CardTitle } from "@/server/engine/card-db/generated";
import type { TriggerEntry } from "@/lib/engine/trigger-types";
import type { GameState } from "@/lib/engine/game";
import { CreateTieFighter } from "@/server/engine/token-helpers";

/**
 * Resolves a single when-played trigger entry against the current game state.
 *
 * These are no-input auto-resolving effects. Cards that require target
 * selection for their when-played ability still go through the
 * ability-target / ability-option PendingResolution flow instead.
 */
export function resolveWhenPlayedTrigger(
  trigger: TriggerEntry,
  gs: GameState,
  log: string[],
): void {
  switch (trigger.cardId) {
    case "SHD_160": // Reckless Gunslinger — When Played: Deal 1 damage to each base.
      gs.player1.base.damage += 1;
      gs.player2.base.damage += 1;
      log.push(`${CardTitle(trigger.cardId)} dealt 1 damage to each base.`);
      break;
    case "JTL_082": // Kijimi Patrollers — When Played: Create a TIE Fighter token.
      CreateTieFighter(gs, trigger.fromPlayer);
      log.push(`${CardTitle(trigger.cardId)}: TIE Fighter token created.`);
      break;
    default:
      break;
  }
}
