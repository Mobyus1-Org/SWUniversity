import type { Game } from "@/lib/engine/game";
import type { CurrentEffect, PlayerId, Unit as UnitInterface, Zones } from "@/lib/engine/core-models";
import type { GameDispatch } from "@/lib/engine/message-types";

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
  /** A value carried to the Yes-effect (e.g. the played card's cost for TWI_018 Quinlan Vos). */
  amount?: number;
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
  /** Zones (e.g. ["Base"]) the target may be chosen from, surfaced to the UI for clickability. */
  fromZones?: Zones[];
  /** Allow the player to select multiple targets at once. */
  needsMultiple?: boolean;
  maxTargets?: number;
  /** A damage/heal amount carried to the effect when it isn't recomputable at apply time
   *  (e.g. SHD_172 Krayt Dragon deals damage equal to the played card's cost). */
  amount?: number;
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

/**
 * A card's "Choose one:" — the player picks one of N modes, each identified by a stable
 * id and shown with a human label. Unlike WhenDefeatedChoicePending (whose options are
 * self-contained encoded effects), a mode here may resolve into a further pending, so the
 * per-card handler decides what each id does.
 */
export interface ChooseOnePending {
  type: "choose-one";
  cardId: string;
  player: PlayerId;
  options: { id: string; label: string }[];
  /** Card-specific payload the chosen mode needs (e.g. Yoda's held card). Must stay serializable. */
  data?: Record<string, string | number>;
  continuation: PendingResolution | null;
}

/**
 * JTL_002 Grand Admiral Thrawn: "When you use a 'When Defeated' ability: You may exhaust this
 * leader (deployed: once each round instead). If you do, use that ability again."
 *
 * Raised *after* the When Defeated ability has resolved. The defeated unit has already left the
 * arena, so a snapshot of it rides along and the ability is re-derived from that on replay.
 */
export interface ThrawnReplayPending {
  type: "thrawn-replay";
  /** Thrawn's controller — the player who used the When Defeated ability. */
  player: PlayerId;
  /** Snapshot of the defeated unit, so its ability can be resolved a second time. */
  defeatedUnit: UnitInterface;
  /** true = deployed side (free, once per round); false = leader side (exhaust as the cost). */
  deployed: boolean;
  continuation: PendingResolution | null;
}

/**
 * "Put a card from your hand on the top or bottom of your deck" (Yoda TWI_004).
 * Step 1 picks the card; the top/bottom choice follows as a ChooseOnePending.
 */
export interface HandToDeckPending {
  type: "hand-to-deck";
  cardId: string;
  player: PlayerId;
  continuation: PendingResolution | null;
}

export interface DiscardFromHandPending {
  type: "discard-from-hand";
  targetPlayer: PlayerId;
  count: number;
  continuation: PendingResolution | null;
  /** SOR_167 Force Throw: if set, after discard capture cost and offer Force damage. */
  forceThrowControllerPlayer?: PlayerId;
  /** JTL_014 Admiral Trench: only cards costing this much or more may be discarded. */
  minCost?: number;
  /** JTL_014 Admiral Trench: after the discard, draw a card for this player ("if you do, draw a card"). */
  thenDrawForPlayer?: PlayerId;
}

/**
 * JTL_014 Admiral Trench — When Deployed: reveal the top 4 cards, the opponent discards 2 of them,
 * then Trench's controller draws 1 of the remaining cards and discards the other. A two-stage
 * choice over the same revealed set (opponent discards first, then the controller draws).
 */
export interface TrenchRevealPending {
  type: "trench-reveal";
  cardId: string;
  /** Trench's controller — owner of the revealed cards (they go to this player's discard/hand). */
  player: PlayerId;
  /** Who chooses at this stage. */
  chooser: PlayerId;
  stage: "opponent-discard" | "self-draw";
  revealed: Array<{ tempId: string; cardId: string }>;
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
  // Context for resuming the entering unit's own entry (Shielded, Ambush, When Played,
  // reactions) AFTER the duplicate is defeated. Uniqueness must interrupt and resolve
  // first, so none of these fire until the player has chosen a copy to defeat.
  enteringPlayId?: string;
  enteringCardId?: string;
  enteringPlayer?: PlayerId;
  enteringInjectEffect?: Omit<CurrentEffect, "targetPlayId">;
  // Downstream resolution to run once uniqueness (and the entering unit's triggers) is
  // fully resolved — used when a duplicate arises mid-way through a larger effect (e.g.
  // multiple copies entering via a deck-search "play").
  continuation?: PendingResolution | null;
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
  /**
   * Hand index already used by an earlier step of a multi-card reveal. A disclose needs the
   * icons spread across *different* cards, so the same card can't be revealed twice.
   */
  excludeHandIndex?: number;
  /** LOF_005 Morgan Elsbeth: the chosen attacked unit whose keyword the played card must share. */
  sharesKeywordWithCardId?: string;
  sharesKeywordWithPlayId?: string;
  sharesKeywordWithPlayer?: PlayerId;
  /** LOF_005 Morgan Elsbeth: play the chosen unit for this many resources less. */
  costReduction?: number;
  /** LOF_016 Qui-Gon Jinn: the played unit's printed cost must be at most this (cost < returned unit). */
  maxCost?: number;
  /** LOF_016 Qui-Gon Jinn: the played unit must NOT have this aspect (non-Villainy). */
  excludeAspect?: string;
  /** LOF_016 Qui-Gon Jinn: play the chosen unit for free (ignore its cost entirely). */
  freePlay?: boolean;
  /** LOF_016 Qui-Gon Jinn (deployed): the attack pipeline to resume after the free play resolves. */
  continuation?: PendingResolution | null;
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

/**
 * Everything needed to replay the dispatch that raised a Credit prompt.
 *
 * The engine reaches a Credit prompt by speculatively running `replayDispatch`,
 * hitting a payment the player has a real choice about, and rolling back.
 * Answering the prompt re-runs `replayDispatch` from the top with the decision
 * appended to `decisions`, so the payment site itself never learns Credits exist.
 */
interface CreditPaymentBase {
  /** The card or ability whose cost is being paid — used for prompt text only. */
  cardId: string;
  playingPlayer: PlayerId;
  /** Full resource cost before any Credit reduction. */
  fullCost: number;
  /** min(Credits controlled, fullCost) — the most Credits worth defeating. */
  maxUseful: number;
  /** max(0, fullCost - ready resources) — Credits that must be defeated regardless. */
  minForced: number;
  /** Which payment of the replayed dispatch this is (0-based). */
  paymentIndex: number;
  replayDispatch: GameDispatch;
  replayPending: PendingResolution | null;
  /** Decisions already made for earlier payments of this same dispatch. */
  decisions: (number | null)[];
}

/**
 * Step 1 of Credit payment: ask whether to defeat Credit tokens for a {1R}
 * discount while paying a cost. Resolved via "choose-option" (Yes/No), where
 * "No" means "defeat only the forced minimum" (usually zero).
 */
export interface CreditPaymentOptionPending extends CreditPaymentBase {
  type: "credit-payment-option";
}

/**
 * Step 2 of Credit payment (only when more than one amount is available): pick
 * how many Credits to defeat, minForced..maxUseful. Resolved via "choose-option"
 * with the number as a string.
 */
export interface CreditPaymentAmountPending extends CreditPaymentBase {
  type: "credit-payment-amount";
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

/**
 * CR 7.6.10 — when triggered abilities from both players wait at the same time, the active
 * player chooses which player resolves their whole stack first ("Mine" vs "Theirs").
 */
export interface TriggerPlayerOrderPending {
  type: "trigger-player-order";
  activePlayer: PlayerId;
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

/**
 * Distribute N token upgrades among eligible units, several allowed on one unit
 * (Helgait ASH_195: "distribute Advantage tokens equal to this unit's power among friendly units").
 * Reuses the spread-damage assignment payload; `optional` means 0 or all, never partial.
 */
export interface SpreadTokensPending {
  type: "spread-tokens";
  cardId: string;
  player: PlayerId;
  totalTokens: number;
  optional: boolean;
  eligiblePlayIds: string[];
  continuation: PendingResolution | null;
}

/**
 * A side effect applied after the heal total is known.
 * "deal-healed-to-self" — deal the healed amount to a predetermined target (e.g. Redemption rebounding damage to itself).
 * "deal-healed-to-unit" — surface a SpreadDamage prompt so the player picks where to deal the healed amount.
 */
export type AfterHealEffect =
  | { type: "deal-healed-to-self"; targetPlayId: string }
  | { type: "deal-healed-to-unit"; eligiblePlayIds: string[]; optional: boolean };

/** Spread up to N heal across any eligible units and/or bases. Each target can receive at most its current damage. Total ≤ maxHeal. */
export interface SpreadHealPending {
  type: "spread-heal";
  cardId: string;
  player: PlayerId;
  maxHeal: number;
  eligiblePlayIds: string[];
  /** When set, applied after the heal total is resolved (e.g. deal healed amount somewhere). */
  afterHeal?: AfterHealEffect;
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
  /** When true, chosen cards are NOT revealed before being drawn/played. Default behaviour is to reveal. */
  dontReveal?: boolean;
  /** What happens to chosen cards: "play" = enter arena, "draw" = go to hand, "scry" = selected go to bottom of deck, unchosen stay on top. */
  action: "play" | "draw" | "scry";
  continuation?: PendingResolution | null;
}

/**
 * Mill N cards from the top of millingPlayer's deck into their discard pile.
 * Processed inline (no client round-trip). Always transitions to a MillResultPending
 * so card-specific post-mill effects can be applied without coupling logic into this type.
 */
export interface MillPending {
  type: "mill";
  cardId: string;
  /** Player who controls the effect (chooses any follow-up targets). */
  player: PlayerId;
  /** Player whose deck is milled. */
  millingPlayer: PlayerId;
  count: number;
  continuation: PendingResolution | null;
}

/**
 * Produced by processMill after cards are moved to discard.
 * Processed inline — carries the milled card IDs so card-specific effects
 * (damage thresholds, aspect counting, etc.) can be resolved in a switch.
 */
export interface MillResultPending {
  type: "mill-result";
  cardId: string;
  player: PlayerId;
  milledCardIds: string[];
  continuation: PendingResolution | null;
}

/**
 * Don't Get Cocky (SOR_223): player reveals cards one at a time, choosing to stop or continue up to 7.
 * If combined cost ≤ 7, deal that damage to targetPlayId.
 */
export interface DontGetCockyPending {
  type: "dont-get-cocky";
  cardId: string;
  player: PlayerId;
  targetPlayId: string;
  revealedCards: Array<{ tempId: string; cardId: string; cost: number }>;
}

/**
 * Bamboozle (SOR_199) alternate-cost prompt: ask whether to discard a Cunning card
 * instead of paying the event's resource cost.
 */
export interface BamboozleAltCostPending {
  type: "bamboozle-alt-cost";
  playingPlayer: PlayerId;
  fullCost: number;
  /** Hand indices of Cunning cards eligible for the alternate cost (after Bamboozle removed). */
  cunningHandIndices: number[];
}

/**
 * Second step when the player chooses the alternate cost: pick which Cunning card to discard.
 */
export interface BamboozleAltCostDiscardPending {
  type: "bamboozle-alt-cost-discard";
  playingPlayer: PlayerId;
  /** Hand indices of the Cunning cards the player may discard (pre-validated). */
  eligibleHandIndices: number[];
}

/**
 * "Choose two, in any order" prompt for the four aspect event cards
 * (SOR_058 Vigilance, SOR_107 Command, SOR_155 Aggression, SOR_203 Cunning).
 * remainingEffects.length === 4 → first pick; === 3 → second pick.
 */
export interface ChooseAspectEffectPending {
  type: "choose-aspect-effect";
  cardId: string;
  player: PlayerId;
  remainingEffects: string[];
  continuation: PendingResolution | null;
}

export type PendingResolution =
  | DontGetCockyPending
  | AttackTargetPending
  | AbilityOptionPending
  | AbilityTargetPending
  | LeaderActionPending
  | WhenDefeatedChoicePending
  | ChooseOnePending
  | ThrawnReplayPending
  | HandToDeckPending
  | DiscardFromHandPending
  | TrenchRevealPending
  | ResolveAttackPending
  | UpgradeTargetPending
  | DefeatCopyPending
  | BountyPending
  | ExploitOptionPending
  | ExploitTargetPending
  | CreditPaymentOptionPending
  | CreditPaymentAmountPending
  | PilotingOptionPending
  | PlotOrderPending
  | PlotWindowPending
  | WhenDeployedPending
  | TriggerOrderPending
  | TriggerPlayerOrderPending
  | SpreadDamagePending
  | SpreadTokensPending
  | OnAttackOrderPending
  | ReturnFromDiscardPending
  | GiveXpMultiplePending
  | ChooseIndirectTargetPending
  | IndirectDamagePending
  | SpreadHealPending
  | PlayFromHandPending
  | DeckSearchPending
  | PeekHandPending
  | MillPending
  | MillResultPending
  | RevealFromHandPending
  | RevealDiscardPending
  | BamboozleAltCostPending
  | BamboozleAltCostDiscardPending
  | ChooseAspectEffectPending;

/**
 * Player selects up to maxCount cards (by hand index) from eligibleIndices to reveal.
 * Each revealed card gives 1 XP to the unit at sourcePlayId.
 */
export interface RevealFromHandPending {
  type: "reveal-from-hand";
  cardId: string;
  player: PlayerId;
  /** Hand indices of cards eligible to reveal (filtered by required aspect). */
  eligibleIndices: number[];
  maxCount: number;
  /** Play ID of the unit receiving XP tokens. */
  sourcePlayId: string;
  continuation: PendingResolution | null;
}

/**
 * Reveal top N cards of the active player's deck. The player may discard any subset; the rest return to the top of the deck in their original order.
 * The triggering effect (e.g. damage per Heroism card) is applied before this pending is created.
 */
export interface RevealDiscardPending {
  type: "reveal-discard";
  cardId: string;
  player: PlayerId;
  /** All revealed cards, in order from bottommost to topmost (last = top of deck). tempId = array index as string. */
  revealedCards: Array<{ tempId: string; cardId: string }>;
  /** Continuation fired after discard choices are resolved. */
  continuation: PendingResolution | null;
}

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
