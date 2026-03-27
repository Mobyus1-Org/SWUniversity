import type { Game } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";

// ---------------------------------------------------------------------------
// Pending resolution variants
// ---------------------------------------------------------------------------

export interface AttackTargetPending {
  type: "attack-target";
  attackerPlayId: string;
  source: string;
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
}

export type PendingResolution =
  | AttackTargetPending
  | AbilityOptionPending
  | AbilityTargetPending
  | LeaderActionPending
  | WhenDefeatedChoicePending;

// ---------------------------------------------------------------------------
// Engine context — passed in and out of processDispatch
// ---------------------------------------------------------------------------

export interface EngineContext {
  game: Game;
  pending: PendingResolution | null;
}
