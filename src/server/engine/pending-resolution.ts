import type { Game } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";

// ---------------------------------------------------------------------------
// Pending resolution variants
// ---------------------------------------------------------------------------

export interface AttackTargetPending {
  type: "attack-target";
  attackerPlayId: string;
  source: string;
  continuation?: PendingResolution | null;
}

export interface AbilityOptionPending {
  type: "ability-option";
  cardId: string;
  sourcePlayId?: string;
  helperText: string;
  onYes?: PendingResolution | null;
  continuation: PendingResolution | null;
}

export interface AbilityTargetPending {
  type: "ability-target";
  cardId: string;
  sourcePlayId?: string;
  fromPlayIds: string[];
  continuation: PendingResolution | null;
}

export interface LeaderActionPending {
  type: "leader-action";
  player: PlayerId;
}

export interface WhenDefeatedChoicePending {
  type: "when-defeated-choice";
  defeatedCardId: string;
  defeatedPlayId: string;
  controlledBy: PlayerId;
  options: string[];
  continuation?: PendingResolution | null;
}

export interface DiscardFromHandPending {
  type: "discard-from-hand";
  targetPlayer: PlayerId;
  count: number;
  continuation: PendingResolution | null;
}

/**
 * The attack target has already been chosen; combat is ready to execute.
 * Used as a continuation after on-attack triggers resolve so that combat
 * fires automatically without asking for a target again.
 */
export interface ResolveAttackPending {
  type: "resolve-attack";
  attackerPlayId: string;
  target: { type: "unit"; playId: string } | { type: "base"; player: PlayerId };
  continuation: PendingResolution | null;
}

export type PendingResolution =
  | AttackTargetPending
  | AbilityOptionPending
  | AbilityTargetPending
  | LeaderActionPending
  | WhenDefeatedChoicePending
  | DiscardFromHandPending
  | ResolveAttackPending;

// ---------------------------------------------------------------------------
// Engine context — passed in and out of processDispatch
// ---------------------------------------------------------------------------

export interface EngineContext {
  game: Game;
  pending: PendingResolution | null;
}
