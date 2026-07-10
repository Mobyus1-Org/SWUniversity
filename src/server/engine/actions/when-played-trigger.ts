import { CardTitle } from "@/server/engine/card-db/generated";
import type { TriggerEntry } from "@/lib/engine/trigger-types";
import type { GameState } from "@/lib/engine/game";
import { DrawCardForPlayer, PlayerHasUnitWithAspectInPlay } from "@/server/engine/core-functions";
import { CreateSpy, CreateTieFighter, CreateBattleDroid } from "@/server/engine/token-helpers";

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
  const player = trigger.fromPlayer === 1 ? gs.player1 : gs.player2;
  const otherPlayer = trigger.fromPlayer === 1 ? gs.player2 : gs.player1;
  switch (trigger.cardId) {
    case "SOR_039": // AT-AT Suppressor — When Played: Exhaust all ground units.
      for (const u of [...player.groundArena, ...otherPlayer.groundArena]) u.ready = false;
      log.push(`${CardTitle(trigger.cardId)}: all ground units exhausted.`);
      break;
    case "SOR_111": // Patrolling V-Wing — When Played: Draw a card.
      DrawCardForPlayer(gs, log, trigger.fromPlayer);
      break;
    case "SHD_160": // Reckless Gunslinger — When Played: Deal 1 damage to each base.
      player.base.damage += 1;
      otherPlayer.base.damage += 1;
      log.push(`${CardTitle(trigger.cardId)} dealt 1 damage to each base.`);
      break;
    case "JTL_082": // Kijimi Patrollers — When Played: Create a TIE Fighter token.
      CreateTieFighter(gs, trigger.fromPlayer, log, trigger.cardId);
      break;
    case "TWI_229": // Battle Droid Escort — When Played: Create a Battle Droid token.
      CreateBattleDroid(gs, trigger.fromPlayer, log, trigger.cardId);
      break;
    case "SOR_134": // Ruthless Raider — When Played with no enemy unit to hit: deal 2 to the enemy base only.
      otherPlayer.base.damage += 2;
      log.push(`${CardTitle(trigger.cardId)}: dealt 2 damage to opponent's base.`);
      break;
    case "SEC_082": { // Chancellor Palpatine — When Played: If you control a leader unit, create 2 Spy tokens and give those tokens Sentinel for this phase.
      const leader082 = trigger.fromPlayer === 1 ? gs.player1.leader : gs.player2.leader;
      if (!leader082.deployed) break;
      for (let i = 0; i < 2; i++) {
        const spy = CreateSpy(gs, trigger.fromPlayer, log, trigger.cardId);
        gs.currentEffects.push({
          cardId: "SEC_082",
          duration: "Phase",
          affectedPlayer: trigger.fromPlayer,
          targetPlayId: spy.playId,
        });
      }
      break;
    }
    case "SEC_083": { // ISB Shuttle — When Played: If a friendly unit was defeated this phase, create a Spy token.
      const wasDefeated = gs.roundState.cardsLeftPlayThisPhase.some(
        c => c.fromPlayer === trigger.fromPlayer && (c.reason === "defeated" || c.reason === "token-defeated"),
      );
      if (!wasDefeated) break;
      CreateSpy(gs, trigger.fromPlayer, log, trigger.cardId);
      break;
    }
    case "SOR_190": { // Lothal Insurgent — If another card was played this phase: each opponent draws a card then discards a random card.
      const playedThisPhase190 = gs.roundState.cardsPlayedThisPhase.filter(c => c.fromPlayer === trigger.fromPlayer);
      if (playedThisPhase190.length <= 1) break; // only this card itself was played
      const opp190 = trigger.fromPlayer === 1 ? 2 : 1;
      DrawCardForPlayer(gs, log, opp190);
      const oppState190 = opp190 === 1 ? gs.player1 : gs.player2;
      const oppHand190 = oppState190.hand;
      if (oppHand190.length > 0) {
        const idx190 = Math.floor(Math.random() * oppHand190.length);
        const [discarded190] = oppHand190.splice(idx190, 1);
        oppState190.discard.push({ cardId: discarded190.cardId, playId: String(gs.nextPlayId++), owner: opp190, controller: opp190, turnDiscarded: gs.currentRound, discardEffect: "" });
        log.push(`${CardTitle(trigger.cardId)}: opponent discarded ${CardTitle(discarded190.cardId)}.`);
      }
      break;
    }
    case "SOR_191": { // Vanguard Ace — For each other card played this phase, give an XP to this unit.
      const pState191 = trigger.fromPlayer === 1 ? gs.player1 : gs.player2;
      const xpCount = gs.roundState.cardsPlayedThisPhase.filter(
        c => c.fromPlayer === trigger.fromPlayer && c.playId !== trigger.playId
      ).length;
      if (xpCount === 0) break;
      const unit191 = [...pState191.spaceArena, ...pState191.groundArena].find(u => u.playId === trigger.playId);
      if (unit191) {
        for (let i = 0; i < xpCount; i++) {
          unit191.upgrades.push({ cardId: "SOR_T01", playId: String(gs.nextPlayId++), owner: unit191.owner, controller: unit191.controller });
        }
        log.push(`${CardTitle(trigger.cardId)}: gained ${xpCount} Experience token(s).`);
      }
      break;
    }
    case "SOR_037": { // Academy Defense Walker — Give an Experience token to each friendly damaged unit.
      const pState037 = trigger.fromPlayer === 1 ? gs.player1 : gs.player2;
      const friendlyUnits037 = [...pState037.groundArena, ...pState037.spaceArena];
      for (const u of friendlyUnits037) {
        if (u.damage > 0) {
          u.upgrades.push({ cardId: "SOR_T01", playId: String(gs.nextPlayId++), owner: u.owner, controller: u.controller });
          log.push(`${CardTitle(trigger.cardId)}: gave Experience to ${CardTitle(u.cardId)}.`);
        }
      }
      break;
    }
    case "SOR_068": { // Cargo Juggernaut — If you control another Vigilance unit, heal 4 from base.
      if (!PlayerHasUnitWithAspectInPlay(trigger.fromPlayer, "Vigilance", true, trigger.playId)) break;
      const base068 = trigger.fromPlayer === 1 ? gs.player1.base : gs.player2.base;
      base068.damage = Math.max(0, base068.damage - 4);
      log.push(`${CardTitle(trigger.cardId)}: healed 4 damage from your base.`);
      break;
    }
    case "SOR_148": { // Guerilla Attack Pod — If a base has 15+ damage, ready this unit.
      if (gs.player1.base.damage < 15 && gs.player2.base.damage < 15) break;
      if (!trigger.playId) break;
      const self148 = [...gs.player1.groundArena, ...gs.player2.groundArena,
                       ...gs.player1.spaceArena, ...gs.player2.spaceArena]
        .find(u => u.playId === trigger.playId);
      if (self148) {
        self148.ready = true;
        log.push(`${CardTitle(trigger.cardId)}: readied because a base has 15 or more damage.`);
      }
      break;
    }
    default:
      break;
  }
}
