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

/** Waiting for the player to choose a unit to attach a played upgrade to. */
export interface UpgradeTargetPending {
  type: "upgrade-target";
  upgradeCardId: string;
  player: PlayerId;
  fromPlayIds: string[];
}

/** Uniqueness rule: player must defeat one copy when a duplicate unique enters play. */
export interface DefeatCopyPending {
  type: "defeat-copy";
  eligiblePlayIds: string[];
}

/** Capture step 1: choose which friendly unit will act as the captor. */
export interface CaptureCaptorPending {
  type: "capture-captor";
  cardId: string;
  fromPlayer: PlayerId;
  eligiblePlayIds: string[];
}

/** Capture step 2: choose which enemy non-leader unit to capture. */
export interface CaptureTargetPending {
  type: "capture-target";
  cardId: string;
  fromPlayer: PlayerId;
  captorPlayId: string;
  eligiblePlayIds: string[];
}

/** Optional bounty collection prompt — shown to the opponent of the defeated/captured unit's controller. */
export interface BountyPending {
  type: "bounty";
  /** The card that carries this bounty (for display in the prompt). */
  cardId: string;
  /** The player who may collect (always the opponent of the bounty unit's controller). */
  collectingPlayer: PlayerId;
  bountyEffect: "draw-card" | "give-shield";
  continuation: PendingResolution | null;
}

/** Step 2 of give-shield bounty: choose which unit receives the Shield token. */
export interface BountyShieldTargetPending {
  type: "bounty-shield-target";
  collectingPlayer: PlayerId;
  fromPlayIds: string[];
  continuation: PendingResolution | null;
}

/** Step 1 of Exploit: prompt the playing player whether to use Exploit. */
export interface ExploitOptionPending {
  type: "exploit-option";
  /** The card being played (already removed from hand). */
  cardId: string;
  playingPlayer: PlayerId;
  /** Pre-computed Exploit amount (report mode — NOT consumed yet). */
  exploitAmount: number;
  /** Full cost before any Exploit reduction. */
  fullCost: number;
}

/** Step 2 of Exploit: player picks up to exploitAmount friendly units to defeat. */
export interface ExploitTargetPending {
  type: "exploit-target";
  cardId: string;
  playingPlayer: PlayerId;
  /** Maximum units that may be defeated (consumed Dooku effect, final amount). */
  exploitAmount: number;
  fullCost: number;
  /** PlayIds of all friendly units eligible to be exploited. */
  fromPlayIds: string[];
}

/** Prompt when a Piloting card can be played either as a unit or as a pilot upgrade. */
export interface PilotingOptionPending {
  type: "piloting-option";
  /** The card being played. For "hand": already removed from hand. For "leader": the leader cardId. */
  cardId: string;
  playingPlayer: PlayerId;
  /** Unit play cost (base + aspect penalty). For "leader": already exhausted. */
  unitCost: number;
  /** Pilot play cost (piloting base + aspect penalty). For "leader": already exhausted. */
  pilotingCost: number;
  /** "hand" = from hand (cost not yet paid). "leader" = epic action deploy (cost already paid). */
  source: "hand" | "leader";
}

export type PendingResolution =
  | AttackTargetPending
  | AbilityOptionPending
  | AbilityTargetPending
  | LeaderActionPending
  | WhenDefeatedChoicePending
  | DiscardFromHandPending
  | ResolveAttackPending
  | UpgradeTargetPending
  | DefeatCopyPending
  | CaptureCaptorPending
  | CaptureTargetPending
  | BountyPending
  | BountyShieldTargetPending
  | ExploitOptionPending
  | ExploitTargetPending
  | PilotingOptionPending;

// ---------------------------------------------------------------------------
// Engine context — passed in and out of processDispatch
// ---------------------------------------------------------------------------

export interface EngineContext {
  game: Game;
  pending: PendingResolution | null;
}
