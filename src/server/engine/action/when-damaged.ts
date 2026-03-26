import { GetUnitsForPlayer } from "../core-functions";
import { PlayerId } from "../core-models";
import {
  DamageSource,
  GameEffect,
  TriggerEntry,
  WhenEnemyUnitDamagedContext,
  WhenFriendlyUnitDamagedContext,
} from "../trigger-types";

// ---------------------------------------------------------------------------
// Dictionaries
// ---------------------------------------------------------------------------

/** Cards with a "When a friendly unit takes damage" ability. */
const cardHasWhenFriendlyUnitDamaged: Record<string, boolean> = {
  // TODO: populate as abilities are implemented
};

/** Cards with a "When an enemy unit takes damage" ability. */
const cardHasWhenEnemyUnitDamaged: Record<string, boolean> = {
  // TODO: populate as abilities are implemented
};

export function CardHasWhenFriendlyUnitDamaged(cardId: string): boolean {
  return cardHasWhenFriendlyUnitDamaged[cardId] === true;
}

export function CardHasWhenEnemyUnitDamaged(cardId: string): boolean {
  return cardHasWhenEnemyUnitDamaged[cardId] === true;
}

// ---------------------------------------------------------------------------
// Trigger collection
// Call after damage has been applied to the unit.
// damageSource is required — some abilities only fire for combat damage,
// others for ability damage, etc.
// ---------------------------------------------------------------------------

/**
 * Queues "When a friendly unit takes damage" triggers from the
 * wounded unit's controller's other units in play.
 * The damaged unit itself does not observe its own damage via this trigger.
 */
export function QueueWhenFriendlyUnitDamagedTriggers(
  damagedCardId: string,
  damagedPlayId: string,
  damagedController: PlayerId,
  damageAmount: number,
  damageSource: DamageSource,
): TriggerEntry[] {
  const triggers: TriggerEntry[] = [];
  const context: WhenFriendlyUnitDamagedContext = {
    type: "when-friendly-unit-damaged",
    damagedCardId,
    damagedPlayId,
    damagedController,
    damageAmount,
    damageSource,
  };

  for (const unit of GetUnitsForPlayer(damagedController)) {
    if (unit.playId === damagedPlayId) continue;
    if (!CardHasWhenFriendlyUnitDamaged(unit.cardId)) continue;
    if (unit.LostAbilities()) continue;

    triggers.push({
      triggerId: `${unit.playId}:when-friendly-damaged:${damagedPlayId}`,
      triggerType: "when-friendly-unit-damaged",
      sourceCardId: unit.cardId,
      sourcePlayId: unit.playId,
      owner: damagedController,
      context,
    });
  }

  return triggers;
}

/**
 * Queues "When an enemy unit takes damage" triggers from the opponent's units.
 */
export function QueueWhenEnemyUnitDamagedTriggers(
  damagedCardId: string,
  damagedPlayId: string,
  damagedController: PlayerId,
  damageAmount: number,
  damageSource: DamageSource,
): TriggerEntry[] {
  const opponent = damagedController === PlayerId.Player1 ? PlayerId.Player2 : PlayerId.Player1;
  const triggers: TriggerEntry[] = [];
  const context: WhenEnemyUnitDamagedContext = {
    type: "when-enemy-unit-damaged",
    damagedCardId,
    damagedPlayId,
    damagedController,
    damageAmount,
    damageSource,
  };

  for (const unit of GetUnitsForPlayer(opponent)) {
    if (!CardHasWhenEnemyUnitDamaged(unit.cardId)) continue;
    if (unit.LostAbilities()) continue;

    triggers.push({
      triggerId: `${unit.playId}:when-enemy-damaged:${damagedPlayId}`,
      triggerType: "when-enemy-unit-damaged",
      sourceCardId: unit.cardId,
      sourcePlayId: unit.playId,
      owner: opponent,
      context,
    });
  }

  return triggers;
}

// ---------------------------------------------------------------------------
// Trigger resolution
// ---------------------------------------------------------------------------

export function ResolveWhenUnitDamagedTrigger(entry: TriggerEntry): GameEffect[] {
  switch (entry.triggerType) {
    case "when-friendly-unit-damaged": return resolveWhenFriendlyUnitDamaged(entry);
    case "when-enemy-unit-damaged":    return resolveWhenEnemyUnitDamaged(entry);
    default: return [];
  }
}

function resolveWhenFriendlyUnitDamaged(entry: TriggerEntry): GameEffect[] {
  // entry.owner, entry.sourcePlayId, (entry.context as WhenFriendlyUnitDamagedContext) available when implementing
  switch (entry.sourceCardId) {
    // TODO: add all cards with "When a friendly unit takes damage:" text
    default:
      return [{ type: "no-op" }];
  }
}

function resolveWhenEnemyUnitDamaged(entry: TriggerEntry): GameEffect[] {
  // entry.owner, entry.sourcePlayId, (entry.context as WhenEnemyUnitDamagedContext) available when implementing
  switch (entry.sourceCardId) {
    // TODO: add all cards with "When an enemy unit takes damage:" text
    default:
      return [{ type: "no-op" }];
  }
}
