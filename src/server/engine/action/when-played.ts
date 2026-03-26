import { GetUnitsForPlayer } from "../core-functions";
import { PlayerId, Zones } from "../core-models";
import { CardHasWhenPlayed } from "../card-db/generated";
import {
  GameEffect,
  TriggerEntry,
  WhenCardPlayedContext,
  WhenDeployedContext,
  WhenOpponentCardPlayedContext,
  WhenPlayedContext,
} from "../trigger-types";

// ---------------------------------------------------------------------------
// Dictionaries for triggers not covered by generated.ts
// ---------------------------------------------------------------------------

/** Cards with a "When a card/unit is played" ability (either player). */
const cardHasWhenCardPlayed: Record<string, boolean> = {
  // TODO: populate as abilities are implemented
};

/** Cards with a "When an opponent plays a card/unit" ability. */
const cardHasWhenOpponentCardPlayed: Record<string, boolean> = {
  // TODO: populate as abilities are implemented
};

/** Cards with a "When Deployed" ability (leader unit enters ground arena). */
const cardHasWhenDeployed: Record<string, boolean> = {
  // TODO: populate as abilities are implemented
};

export function CardHasWhenCardPlayed(cardId: string): boolean {
  return cardHasWhenCardPlayed[cardId] === true;
}

export function CardHasWhenOpponentCardPlayed(cardId: string): boolean {
  return cardHasWhenOpponentCardPlayed[cardId] === true;
}

export function CardHasWhenDeployed(cardId: string): boolean {
  return cardHasWhenDeployed[cardId] === true;
}

// ---------------------------------------------------------------------------
// Trigger collection
// Call these immediately AFTER a card enters play (before any state cleanup).
// ---------------------------------------------------------------------------

/**
 * Queues the "When Played" trigger for the card that was just played.
 * Only the played card's own ability fires as a WhenPlayed trigger.
 */
export function QueueWhenPlayedTriggers(
  playedCardId: string,
  playedPlayId: string,
  playedByPlayer: PlayerId,
  playedFrom: Zones,
): TriggerEntry[] {
  if (!CardHasWhenPlayed(playedCardId)) return [];

  const context: WhenPlayedContext = {
    type: "when-played",
    playedCardId,
    playedPlayId,
    playedByPlayer,
    playedFrom,
  };

  return [{
    triggerId: `${playedPlayId}:when-played`,
    triggerType: "when-played",
    sourceCardId: playedCardId,
    sourcePlayId: playedPlayId,
    owner: playedByPlayer,
    context,
  }];
}

/**
 * Queues "When a card/unit is played" triggers from all units in both arenas.
 * Call after any card enters play. The played card cannot observe its own entry.
 */
export function QueueWhenCardPlayedTriggers(
  playedCardId: string,
  playedPlayId: string,
  playedByPlayer: PlayerId,
  playedFrom: Zones,
): TriggerEntry[] {
  const triggers: TriggerEntry[] = [];
  const context: WhenCardPlayedContext = {
    type: "when-card-played",
    playedCardId,
    playedPlayId,
    playedByPlayer,
    playedFrom,
  };

  for (const player of [PlayerId.Player1, PlayerId.Player2] as PlayerId[]) {
    for (const unit of GetUnitsForPlayer(player)) {
      if (unit.playId === playedPlayId) continue;
      if (!CardHasWhenCardPlayed(unit.cardId)) continue;
      if (unit.LostAbilities()) continue;

      triggers.push({
        triggerId: `${unit.playId}:when-card-played:${playedPlayId}`,
        triggerType: "when-card-played",
        sourceCardId: unit.cardId,
        sourcePlayId: unit.playId,
        owner: player,
        context,
      });
    }
  }

  return triggers;
}

/**
 * Queues "When an opponent plays a card/unit" triggers from the opponent's units.
 * Only units controlled by the non-active player can hold this trigger type.
 */
export function QueueWhenOpponentCardPlayedTriggers(
  playedCardId: string,
  playedPlayId: string,
  playedByPlayer: PlayerId,
  playedFrom: Zones,
): TriggerEntry[] {
  const opponent = playedByPlayer === PlayerId.Player1 ? PlayerId.Player2 : PlayerId.Player1;
  const triggers: TriggerEntry[] = [];
  const context: WhenOpponentCardPlayedContext = {
    type: "when-opponent-card-played",
    playedCardId,
    playedPlayId,
    playedByPlayer,
    playedFrom,
  };

  for (const unit of GetUnitsForPlayer(opponent)) {
    if (!CardHasWhenOpponentCardPlayed(unit.cardId)) continue;
    if (unit.LostAbilities()) continue;

    triggers.push({
      triggerId: `${unit.playId}:when-opp-card-played:${playedPlayId}`,
      triggerType: "when-opponent-card-played",
      sourceCardId: unit.cardId,
      sourcePlayId: unit.playId,
      owner: opponent,
      context,
    });
  }

  return triggers;
}

/**
 * Queues "When Deployed" trigger for the leader that just flipped to its unit side.
 * Also the timing window where Shielded leader units gain their shield token.
 * Call immediately after the leader unit enters the ground arena.
 */
export function QueueWhenDeployedTriggers(
  leaderCardId: string,
  leaderUnitPlayId: string,
  deployedByPlayer: PlayerId,
): TriggerEntry[] {
  if (!CardHasWhenDeployed(leaderCardId)) return [];

  const context: WhenDeployedContext = {
    type: "when-deployed",
    leaderCardId,
    leaderUnitPlayId,
    deployedByPlayer,
  };

  return [{
    triggerId: `${leaderUnitPlayId}:when-deployed`,
    triggerType: "when-deployed",
    sourceCardId: leaderCardId,
    sourcePlayId: leaderUnitPlayId,
    owner: deployedByPlayer,
    context,
  }];
}

// ---------------------------------------------------------------------------
// Effects requiring player target selection return { type: "no-op" } until
// the interactive targeting system is implemented.
// ---------------------------------------------------------------------------

export function ResolveWhenPlayedTrigger(entry: TriggerEntry): GameEffect[] {
  switch (entry.triggerType) {
    case "when-played":               return resolveWhenPlayed(entry);
    case "when-card-played":          return resolveWhenCardPlayed(entry);
    case "when-opponent-card-played": return resolveWhenOpponentCardPlayed(entry);
    case "when-deployed":             return resolveWhenDeployed(entry);
    default: return [];
  }
}

function resolveWhenPlayed(entry: TriggerEntry): GameEffect[] {
  // entry.owner, entry.sourcePlayId, (entry.context as WhenPlayedContext) available when implementing
  switch (entry.sourceCardId) {
    // TODO: SOR_014 — Sabine Wren (Spectre Two): deal 1 damage to a unit or base
    // TODO: add all cards with "When Played:" text
    default:
      return [{ type: "no-op" }];
  }
}

function resolveWhenCardPlayed(entry: TriggerEntry): GameEffect[] {
  // entry.owner, entry.sourcePlayId, (entry.context as WhenCardPlayedContext) available when implementing
  switch (entry.sourceCardId) {
    // TODO: add all cards with "When a card/unit is played:" text
    default:
      return [{ type: "no-op" }];
  }
}

function resolveWhenOpponentCardPlayed(entry: TriggerEntry): GameEffect[] {
  // entry.owner, entry.sourcePlayId, (entry.context as WhenOpponentCardPlayedContext) available when implementing
  switch (entry.sourceCardId) {
    // TODO: add all cards with "When an opponent plays a card/unit:" text
    default:
      return [{ type: "no-op" }];
  }
}

function resolveWhenDeployed(entry: TriggerEntry): GameEffect[] {
  // (entry.context as WhenDeployedContext).leaderUnitPlayId available when implementing
  switch (entry.sourceCardId) {
    // TODO: add all leaders with "When Deployed:" text
    default:
      return [{ type: "no-op" }];
  }
}
