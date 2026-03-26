import { GetUnitsForPlayer } from "../core-functions";
import { PlayerId } from "../core-models";
import { CardHasWhenDefeated } from "../card-db/generated";
import {
  GameEffect,
  TriggerEntry,
  WhenDefeatedContext,
  WhenEnemyUnitDefeatedContext,
  WhenFriendlyUnitDefeatedContext,
} from "../trigger-types";

// ---------------------------------------------------------------------------
// Dictionaries for triggers not covered by generated.ts
// ---------------------------------------------------------------------------

/** Cards with a "When a friendly unit is defeated" ability. */
const cardHasWhenFriendlyUnitDefeated: Record<string, boolean> = {
  // TODO: populate as abilities are implemented
};

/** Cards with a "When an enemy unit is defeated" ability. */
const cardHasWhenEnemyUnitDefeated: Record<string, boolean> = {
  // TODO: populate as abilities are implemented
};

export function CardHasWhenFriendlyUnitDefeated(cardId: string): boolean {
  return cardHasWhenFriendlyUnitDefeated[cardId] === true;
}

export function CardHasWhenEnemyUnitDefeated(cardId: string): boolean {
  return cardHasWhenEnemyUnitDefeated[cardId] === true;
}

// ---------------------------------------------------------------------------
// Trigger collection
// IMPORTANT: call all collect functions BEFORE removing the defeated unit
// from the arena so its data (cardId, playId, upgrades) is still accessible.
// ---------------------------------------------------------------------------

/**
 * Queues the "When Defeated" trigger for the unit itself.
 * Call before removing the defeated unit from the arena.
 */
export function QueueWhenDefeatedTriggers(
  defeatedCardId: string,
  defeatedPlayId: string,
  defeatedController: PlayerId,
  defeatedByPlayer: PlayerId,
): TriggerEntry[] {
  if (!CardHasWhenDefeated(defeatedCardId)) return [];

  const context: WhenDefeatedContext = {
    type: "when-defeated",
    defeatedCardId,
    defeatedPlayId,
    defeatedController,
    defeatedByPlayer,
  };

  return [{
    triggerId: `${defeatedPlayId}:when-defeated`,
    triggerType: "when-defeated",
    sourceCardId: defeatedCardId,
    sourcePlayId: defeatedPlayId,
    owner: defeatedController,
    context,
  }];
}

/**
 * Queues "When a friendly unit is defeated" triggers from the controller's
 * other units in play. Call before removing the defeated unit from the arena.
 */
export function QueueWhenFriendlyUnitDefeatedTriggers(
  defeatedCardId: string,
  defeatedPlayId: string,
  defeatedController: PlayerId,
  defeatedByPlayer: PlayerId,
): TriggerEntry[] {
  const triggers: TriggerEntry[] = [];
  const context: WhenFriendlyUnitDefeatedContext = {
    type: "when-friendly-unit-defeated",
    defeatedCardId,
    defeatedPlayId,
    defeatedController,
    defeatedByPlayer,
  };

  for (const unit of GetUnitsForPlayer(defeatedController)) {
    if (unit.playId === defeatedPlayId) continue;
    if (!CardHasWhenFriendlyUnitDefeated(unit.cardId)) continue;
    if (unit.LostAbilities()) continue;

    triggers.push({
      triggerId: `${unit.playId}:when-friendly-defeated:${defeatedPlayId}`,
      triggerType: "when-friendly-unit-defeated",
      sourceCardId: unit.cardId,
      sourcePlayId: unit.playId,
      owner: defeatedController,
      context,
    });
  }

  return triggers;
}

/**
 * Queues "When an enemy unit is defeated" triggers from the opponent's units.
 * Call before removing the defeated unit from the arena.
 */
export function QueueWhenEnemyUnitDefeatedTriggers(
  defeatedCardId: string,
  defeatedPlayId: string,
  defeatedController: PlayerId,
  defeatedByPlayer: PlayerId,
): TriggerEntry[] {
  const opponent = defeatedController === PlayerId.Player1 ? PlayerId.Player2 : PlayerId.Player1;
  const triggers: TriggerEntry[] = [];
  const context: WhenEnemyUnitDefeatedContext = {
    type: "when-enemy-unit-defeated",
    defeatedCardId,
    defeatedPlayId,
    defeatedController,
    defeatedByPlayer,
  };

  for (const unit of GetUnitsForPlayer(opponent)) {
    if (!CardHasWhenEnemyUnitDefeated(unit.cardId)) continue;
    if (unit.LostAbilities()) continue;

    triggers.push({
      triggerId: `${unit.playId}:when-enemy-defeated:${defeatedPlayId}`,
      triggerType: "when-enemy-unit-defeated",
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

export function ResolveWhenDefeatedTrigger(entry: TriggerEntry): GameEffect[] {
  switch (entry.triggerType) {
    case "when-defeated":             return resolveWhenDefeated(entry);
    case "when-friendly-unit-defeated": return resolveWhenFriendlyUnitDefeated(entry);
    case "when-enemy-unit-defeated":   return resolveWhenEnemyUnitDefeated(entry);
    default: return [];
  }
}

function resolveWhenDefeated(entry: TriggerEntry): GameEffect[] {
  // entry.owner, entry.sourcePlayId, (entry.context as WhenDefeatedContext) available when implementing
  switch (entry.sourceCardId) {
    // TODO: add all cards with "When Defeated:" text
    default:
      return [{ type: "no-op" }];
  }
}

function resolveWhenFriendlyUnitDefeated(entry: TriggerEntry): GameEffect[] {
  // entry.owner, entry.sourcePlayId, (entry.context as WhenFriendlyUnitDefeatedContext) available when implementing
  switch (entry.sourceCardId) {
    // TODO: add all cards with "When a friendly unit is defeated:" text
    default:
      return [{ type: "no-op" }];
  }
}

function resolveWhenEnemyUnitDefeated(entry: TriggerEntry): GameEffect[] {
  // entry.owner, entry.sourcePlayId, (entry.context as WhenEnemyUnitDefeatedContext) available when implementing
  switch (entry.sourceCardId) {
    // TODO: add all cards with "When an enemy unit is defeated:" text
    default:
      return [{ type: "no-op" }];
  }
}
