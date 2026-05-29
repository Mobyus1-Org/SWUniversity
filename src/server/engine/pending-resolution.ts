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
  saboteurApplied?: boolean;
}

export interface AbilityOptionPending {
  type: "ability-option";
  cardId: string;
  sourcePlayId?: string;
  player?: PlayerId;
  helperText: string;
  yesLabel?: string;
  noLabel?: string;
  onYes?: PendingResolution | null;
  continuation: PendingResolution | null;
}

export interface AbilityTargetPending {
  type: "ability-target";
  cardId: string;
  sourcePlayId?: string;
  /** The player who initiated this ability (needed for take-control effects). */
  player?: PlayerId;
  fromPlayIds: string[];
  fromChoices?: string[];
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
  /** Set when Saboteur was already resolved before combat (prevents double-stripping). */
  saboteurApplied?: boolean;
}

export interface OnAttackTriggerEntry {
  cardId: string;  // upgrade/card ID, or "saboteur" for the Saboteur keyword
  label: string;
}

/** Player must choose which On Attack ability to resolve first when 2+ triggers are pending. */
export interface OnAttackOrderPending {
  type: "on-attack-order";
  attackerPlayId: string;
  player: PlayerId;
  triggers: OnAttackTriggerEntry[];
  continuation: ResolveAttackPending;
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

/** Optional bounty collection prompt — shown to the opponent of the defeated/captured unit's controller. */
export interface BountyPending {
  type: "bounty";
  /** The card that carries this bounty (for display in the prompt). */
  cardId: string;
  /** The player who may collect (always the opponent of the bounty unit's controller). */
  collectingPlayer: PlayerId;
  continuation: PendingResolution | null;
}

/** Generic "pick a card from hand to play" — cardId identifies validation + execution logic. */
export interface PlayFromHandPending {
  type: "play-from-hand";
  /** Card granting this ability (e.g. "SOR_022" for ECL, "TWI_005" for Count Dooku). */
  cardId: string;
  player: PlayerId;
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

/** Plot mechanic step 1: ask whether to use Plot before or after When Deployed. */
export interface PlotOrderPending {
  type: "plot-order";
  player: PlayerId;
  leaderCardId: string;
  plotResourcePlayIds: string[];
}

/** Plot mechanic step 2: player selects which Plot card in resources to play (or passes with empty targetPlayIds). */
export interface PlotWindowPending {
  type: "plot-window";
  player: PlayerId;
  leaderCardId: string;
  plotResourcePlayIds: string[];
  fireWhenDeployedAfter: boolean;
}

/** Auto-resolving continuation that fires the leader's When Deployed effect after Plot window closes. */
export interface WhenDeployedPending {
  type: "when-deployed";
  leaderCardId: string;
  player: PlayerId;
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

/**
 * Presented when the triggerBag has 2+ simultaneous triggers (e.g. Ambush + When Played).
 * The player picks one label to resolve first; the rest stay in the bag.
 */
export interface TriggerOrderPending {
  type: "trigger-order";
  triggers: Array<{
    label: string;
    triggerType: string;
    cardId: string;
    playId?: string;
    fromPlayer: PlayerId;
  }>;
}


/** Spread N damage simultaneously across eligible units. */
export interface SpreadDamagePending {
  type: "spread-damage";
  cardId: string;
  player: PlayerId;
  totalDamage: number;
  /** true = "you may" (0 or all, never partial). false = must assign exactly totalDamage. */
  optional: boolean;
  eligiblePlayIds: string[];
  continuation: PendingResolution | null;
}

/** Return up to N units from the discard pile to hand (e.g. Admiral Trench TWI_086). */
export interface ReturnFromDiscardPending {
  type: "return-from-discard";
  cardId: string;
  player: PlayerId;
  maxCount: number;
  eligiblePlayIds: string[];
  continuation: PendingResolution | null;
}

/**
 * First step for "deal X indirect damage to a player" effects: the source player
 * chooses whether to target themselves or their opponent.
 */
export interface ChooseIndirectTargetPending {
  type: "choose-indirect-target";
  cardId: string;
  sourcePlayer: PlayerId;
  totalDamage: number;
}

/**
 * Indirect damage: the targetPlayer assigns totalDamage unpreventably among
 * their own units and/or base. Shields are NOT removed (CR 8.36.2).
 */
export interface IndirectDamagePending {
  type: "indirect-damage";
  cardId: string;
  sourcePlayer: PlayerId;
  targetPlayer: PlayerId;
  totalDamage: number;
  eligibleUnitPlayIds: string[];
  continuation: PendingResolution | null;
}

/** Give an Experience token to each of up to N chosen units (e.g. General Tagge SOR_080). */
export interface GiveXpMultiplePending {
  type: "give-xp-multiple";
  cardId: string;
  player: PlayerId;
  maxCount: number;
  eligiblePlayIds: string[];
  continuation: PendingResolution | null;
}

/**
 * Deck search: player picks any number of eligible cards from the top N of their deck; the rest go to the bottom in a random order.
 * Options include:
 * maxChoices: maximum number of cards the player can choose, regardless of cost
 * maxCombinedCost: maximum total cost of chosen cards, regardless of number (eg. SOR_087 or SOR_104)
 * costModifier: Each chosen card is played for free (or at reduced cost) 'free' | number (usually less than 0)
 */
export interface DeckSearchPending {
  type: "deck-search";
  cardId: string;
  player: PlayerId;
  /** All top-N cards extracted from the deck (in original order, last = top). */
  topCards: Array<{ tempId: string; cardId: string }>;
  /** Subset of topCards that are eligible to pick (eg. Villainy units with cost ≤ maxCombinedCost). */
  eligibleChoices: Array<{ tempId: string; cardId: string; cost: number }>;
  maxChoices?: number;
  maxCombinedCost?: number;
  costModifier?: 'free' | number;
  /** What happens to chosen cards: "play" = enter arena, "draw" = go to hand, "scry" = selected go to bottom of deck, unchosen stay on top. */
  action: "play" | "draw" | "scry";
  continuation?: PendingResolution | null;
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
  | BountyPending
  | ExploitOptionPending
  | ExploitTargetPending
  | PilotingOptionPending
  | PlotOrderPending
  | PlotWindowPending
  | WhenDeployedPending
  | TriggerOrderPending
  | SpreadDamagePending
  | OnAttackOrderPending
  | ReturnFromDiscardPending
  | GiveXpMultiplePending
  | ChooseIndirectTargetPending
  | IndirectDamagePending
  | PlayFromHandPending
  | DeckSearchPending
  | PeekHandPending;

export interface PeekHandPending {
  type: "peek-hand";
  /** The player doing the peeking (choosing which card to discard, if applicable). */
  peekingPlayer: PlayerId;
  /** The player whose hand is being peeked. */
  targetPlayer: PlayerId;
  /** If true, the peeking player must choose one card from the target hand to discard. */
  mustDiscard: boolean;
  /** If set, only cards of this type are eligible to be discarded. */
  discardFilter?: "non-unit";
  continuation: PendingResolution | null;
}

// ---------------------------------------------------------------------------
// Engine context — passed in and out of processDispatch
// ---------------------------------------------------------------------------

export interface EngineContext {
  game: Game;
  pending: PendingResolution | null;
}
