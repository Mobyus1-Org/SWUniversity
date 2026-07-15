import { PlayerId } from "@/lib/engine/core-models";
import { GetCurrentEffectsForPlayer, GetUnitInPlay, GetUnitsForPlayer } from "@/server/engine/core-functions";

/**
 * Support — "When you play this unit (or deploy this leader), you may attack with another unit.
 * It gains this unit's other abilities for this attack."
 *
 * The "gains this unit's other abilities" half is modelled as a ForAttack currentEffect on the
 * supported attacker whose cardId is `support:<supporter cardId>`. Every attack-time ability
 * lookup (keywords, On Attack, When Attack Ends, while-attacking modifiers) resolves its sources
 * through AttackAbilityCardIds / SupportGrantedCardId below, so the supporter's printed abilities
 * apply to the attacker with "this unit" correctly meaning the attacker.
 */
export const SUPPORT_GRANT_PREFIX = "support:";

/** The currentEffect a supporter puts on the unit it sends into the attack. */
export function SupportGrantEffectCardId(supporterCardId: string): string {
  return `${SUPPORT_GRANT_PREFIX}${supporterCardId}`;
}

/**
 * The card whose abilities `playId` has gained for the attack it is currently making, or null.
 * Only ever set for the duration of one attack (duration: "ForAttack").
 */
export function SupportGrantedCardId(playId?: string, player?: PlayerId): string | null {
  if (!playId || !player) return null;
  for (const currentEffect of GetCurrentEffectsForPlayer(player)) {
    if (!currentEffect.cardId.startsWith(SUPPORT_GRANT_PREFIX)) continue;
    if (currentEffect.targetPlayId !== playId) continue;
    return currentEffect.cardId.slice(SUPPORT_GRANT_PREFIX.length);
  }
  return null;
}

/**
 * Every card whose abilities apply to this attacker right now: its own, plus any it gained from
 * a Support unit for this attack. Use this at any site that switches on `attacker.cardId` for
 * attack-time abilities (On Attack, When Attack Ends, while-attacking stat changes).
 * A unit that has lost its abilities gains nothing.
 */
export function AttackAbilityCardIds(unit: { cardId: string; playId: string; controller: PlayerId; LostAbilities(): boolean }): string[] {
  if (unit.LostAbilities()) return [];
  const granted = SupportGrantedCardId(unit.playId, unit.controller);
  return granted ? [unit.cardId, granted] : [unit.cardId];
}

/**
 * ASH_068 Domesticated Loth-Cat — "Enemy units lose Ambush and Support." True for the units of a
 * player whose OPPONENT controls a Loth-Cat with its abilities intact. Not modelled as a
 * currentEffect: those are only read for their own controller, and this must reach across the
 * table. Same shape as ASH_040 Poe Dameron's Sentinel suppression.
 */
export function EnemyUnitsLoseAmbushAndSupport(player: PlayerId): boolean {
  const opponent: PlayerId = player === 1 ? 2 : 1;
  return GetUnitsForPlayer(opponent).some(u => {
    if (u.cardId !== "ASH_068") return false;
    const lothCat = GetUnitInPlay(u.playId, opponent);
    return !!lothCat && !lothCat.LostAbilities();
  });
}

export function HasSupport(cardId: string, playId?: string, player?: PlayerId): boolean {
  if (player && EnemyUnitsLoseAmbushAndSupport(player)) return false;

  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (unit?.LostAbilities()) return false;
  }

  switch (cardId) {
    //ASH
    case "ASH_009"://Ahsoka Tano (Trust in the Force) leader unit
    case "ASH_014"://The Mandalorian (We Can't Keep Running) leader unit
    case "ASH_033"://Grand Admiral Thrawn
    case "ASH_036"://Rukh
    case "ASH_037"://Red Leader
    case "ASH_046"://Scion Shuttle
    case "ASH_050"://Morgan Elsbeth
    case "ASH_059"://Leia Organa
    case "ASH_072"://Doctor Pershing
    case "ASH_074"://Mos Eisley Modifier
    case "ASH_095"://Remnant Interceptor
    case "ASH_099"://Gozanti Assault Carrier
    case "ASH_101"://The Great Mothers
    case "ASH_121"://Blurrg
    case "ASH_130"://Fang Fighter Squadron
    case "ASH_154"://Honorable Nite Owl
    case "ASH_156"://R5-D4
    case "ASH_168"://Migs Mayfeld
    case "ASH_189"://Emperor's Messenger
    case "ASH_202"://Carson Teva
    case "ASH_203"://Mando's N-1 Starfighter
    case "ASH_209"://Ezra Bridger
    case "ASH_215"://Flanking TIE Interceptor
    case "ASH_222"://Unsanctioned Patrol
    case "ASH_223"://Halo
    case "ASH_241"://Marrok's Fiend Fighter
    case "ASH_253"://Yellow Aces Bomber
      return true;
    default:
      return false;
  }
}
