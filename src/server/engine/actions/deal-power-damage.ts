import type { PlayerId } from "@/lib/engine/core-models";
import type { GameState } from "@/lib/engine/game";
import { AbilityTargetPending } from "@/server/engine/pending-resolution";
import { GetUnitsForPlayer, GetOtherPlayer, GetUnitByPlayId, DealDamageToUnit } from "@/server/engine/core-functions";
import { Unit } from "@/server/engine/unit";
import { CardArena } from "@/server/engine/card-db/generated";

// Shared mechanic: "<a friendly unit> deals damage equal to <its power | its remaining HP> to
// <an enemy unit>." Used by Strike True (SOR_127), Haymaker (LAW_168), Director Krennic's deployed
// side (LAW_008), and Protect the Pod (LOF_128, remaining HP + non-Vehicle restriction).
// Callers wire two dispatch "choose-target" cases: the first (cardId) resolves the friendly pick and
// builds step 2; the second (dealCardId) applies the damage.

/** Step 1 — choose the friendly unit that will deal the damage. Null if no eligible friendly unit. */
export function chooseFriendlyForPowerDamage(
  cardId: string,
  player: PlayerId,
  opts: { excludePlayId?: string; filter?: (unit: Unit) => boolean } = {},
): AbilityTargetPending | null {
  const friendly = GetUnitsForPlayer(player)
    .filter(u => u.playId !== opts.excludePlayId)
    .filter(u => (opts.filter ? opts.filter(u) : true));
  if (friendly.length === 0) return null;
  return { type: "ability-target", cardId, player, fromPlayIds: friendly.map(u => u.playId), continuation: null };
}

/** Step 2 — given the chosen friendly unit, choose the enemy unit to damage. Null if none eligible. */
export function chooseEnemyForPowerDamage(
  dealCardId: string,
  player: PlayerId,
  friendlyPlayId: string,
  game: GameState,
  opts: { sameArena?: boolean } = {},
): AbilityTargetPending | null {
  let enemies = GetUnitsForPlayer(GetOtherPlayer(player));
  if (opts.sameArena) {
    const friendly = GetUnitByPlayId(game, friendlyPlayId);
    if (!friendly) return null;
    const friendlyArena = CardArena(friendly.cardId) ?? "Ground";
    enemies = enemies.filter(u => (CardArena(u.cardId) ?? "Ground") === friendlyArena);
  }
  if (enemies.length === 0) return null;
  return { type: "ability-target", cardId: dealCardId, player, sourcePlayId: friendlyPlayId, fromPlayIds: enemies.map(u => u.playId), continuation: null };
}

/** Resolve — deal the chosen friendly unit's REMAINING HP to the chosen enemy unit. */
export function dealRemainingHpToEnemy(
  game: GameState,
  gameLog: string[],
  sourceLabel: string,
  friendlyPlayId: string,
  enemyPlayId: string,
): void {
  const source = GetUnitByPlayId(game, friendlyPlayId);
  if (!source) return;
  const remainingHp = Unit.FromInterface(source).CurrentHP();
  DealDamageToUnit(game, sourceLabel, enemyPlayId, remainingHp, gameLog);
}

/** Resolve — deal the chosen friendly unit's current power to the chosen enemy unit. */
export function dealPowerToEnemy(
  game: GameState,
  gameLog: string[],
  sourceLabel: string,
  friendlyPlayId: string,
  enemyPlayId: string,
): void {
  const attacker = GetUnitByPlayId(game, friendlyPlayId);
  if (!attacker) return;
  const power = Unit.FromInterface(attacker).CurrentPower();
  DealDamageToUnit(game, sourceLabel, enemyPlayId, power, gameLog);
}
