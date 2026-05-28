import { CardTitle } from "@/server/engine/card-db/generated";
import type { TriggerEntry } from "@/lib/engine/trigger-types";
import type { GameState } from "@/lib/engine/game";
import { DrawCardForPlayer } from "@/server/engine/core-functions";
import { CreateSpy, CreateTieFighter } from "@/server/engine/token-helpers";

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
    case "SOR_039": // AT-AT Suppressor — When Played: Exhaust all ground units.
      for (const u of [...gs.player1.groundArena, ...gs.player2.groundArena]) u.ready = false;
      log.push(`${CardTitle(trigger.cardId)}: all ground units exhausted.`);
      break;
    case "SOR_111": // Patrolling V-Wing — When Played: Draw a card.
      DrawCardForPlayer(gs, log, trigger.fromPlayer);
      break;
    case "SHD_160": // Reckless Gunslinger — When Played: Deal 1 damage to each base.
      gs.player1.base.damage += 1;
      gs.player2.base.damage += 1;
      log.push(`${CardTitle(trigger.cardId)} dealt 1 damage to each base.`);
      break;
    case "JTL_082": // Kijimi Patrollers — When Played: Create a TIE Fighter token.
      CreateTieFighter(gs, trigger.fromPlayer);
      log.push(`${CardTitle(trigger.cardId)}: TIE Fighter token created.`);
      break;
    case "SEC_082": { // Chancellor Palpatine — When Played: If you control a leader unit, create 2 Spy tokens and give those tokens Sentinel for this phase.
      const leader082 = trigger.fromPlayer === 1 ? gs.player1.leader : gs.player2.leader;
      if (!leader082.deployed) break;
      for (let i = 0; i < 2; i++) {
        const spy = CreateSpy(gs, trigger.fromPlayer);
        gs.currentEffects.push({
          cardId: "SEC_082",
          duration: "Phase",
          affectedPlayer: trigger.fromPlayer,
          targetPlayId: spy.playId,
        });
      }
      log.push(`${CardTitle(trigger.cardId)}: created 2 Spy tokens with Sentinel.`);
      break;
    }
    case "SEC_083": { // ISB Shuttle — When Played: If a friendly unit was defeated this phase, create a Spy token.
      const wasDefeated = gs.roundState.cardsLeftPlayThisPhase.some(
        c => c.fromPlayer === trigger.fromPlayer && (c.reason === "defeated" || c.reason === "token-defeated"),
      );
      if (!wasDefeated) break;
      CreateSpy(gs, trigger.fromPlayer);
      log.push(`${CardTitle(trigger.cardId)}: created a Spy token.`);
      break;
    }
    default:
      break;
  }
}
