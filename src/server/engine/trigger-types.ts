import { PlayerId, Zones } from "./core-models";

// ---------------------------------------------------------------------------
// Trigger Types
// ---------------------------------------------------------------------------

export type TriggerType =
  | "when-played"
  | "when-card-played"
  | "when-opponent-card-played"
  | "when-deployed"
  | "when-defeated"
  | "when-friendly-unit-defeated"
  | "when-enemy-unit-defeated"
  | "when-friendly-unit-damaged"
  | "when-enemy-unit-damaged"
  | "action-ability";

// ---------------------------------------------------------------------------
// Trigger Contexts — serializable (must survive JSON round-trips)
// ---------------------------------------------------------------------------

export interface WhenPlayedContext {
  type: "when-played";
  playedCardId: string;
  playedPlayId: string;
  playedByPlayer: PlayerId;
  /** Zone the card was in immediately before entering play (almost always Zones.Hand). */
  playedFrom: Zones;
}

export interface WhenCardPlayedContext {
  type: "when-card-played";
  playedCardId: string;
  playedPlayId: string;
  playedByPlayer: PlayerId;
  /** Zone the card was in immediately before entering play. */
  playedFrom: Zones;
}

export interface WhenOpponentCardPlayedContext {
  type: "when-opponent-card-played";
  playedCardId: string;
  playedPlayId: string;
  playedByPlayer: PlayerId;
  /** Zone the card was in immediately before entering play. */
  playedFrom: Zones;
}

/**
 * Fired when a leader is deployed (flipped from the Leader zone to the ground arena).
 * This is NOT a "When Played" trigger — deploying a leader is a distinct game action.
 * Leader units with Shielded also gain their shield token in this timing window.
 */
export interface WhenDeployedContext {
  type: "when-deployed";
  leaderCardId: string;
  /** playId assigned to the leader unit in the ground arena after deployment. */
  leaderUnitPlayId: string;
  deployedByPlayer: PlayerId;
}

export interface WhenDefeatedContext {
  type: "when-defeated";
  defeatedCardId: string;
  defeatedPlayId: string;
  defeatedController: PlayerId;
  defeatedByPlayer: PlayerId;
}

export interface WhenFriendlyUnitDefeatedContext {
  type: "when-friendly-unit-defeated";
  defeatedCardId: string;
  defeatedPlayId: string;
  defeatedController: PlayerId;
  defeatedByPlayer: PlayerId;
}

export interface WhenEnemyUnitDefeatedContext {
  type: "when-enemy-unit-defeated";
  defeatedCardId: string;
  defeatedPlayId: string;
  defeatedController: PlayerId;
  defeatedByPlayer: PlayerId;
}

/** Identifies the source of damage for when-damaged triggers. */
export interface DamageSource {
  kind: "attack" | "ability" | "event";
  /** playId of the unit/card that dealt the damage, if applicable */
  sourcePlayId?: string;
  /** cardId of the unit/card that dealt the damage, if applicable */
  sourceCardId?: string;
  /** player that controlled the damage source */
  sourcePlayer?: PlayerId;
}

export interface WhenFriendlyUnitDamagedContext {
  type: "when-friendly-unit-damaged";
  damagedCardId: string;
  damagedPlayId: string;
  damagedController: PlayerId;
  damageAmount: number;
  damageSource: DamageSource;
}

export interface WhenEnemyUnitDamagedContext {
  type: "when-enemy-unit-damaged";
  damagedCardId: string;
  damagedPlayId: string;
  damagedController: PlayerId;
  damageAmount: number;
  damageSource: DamageSource;
}

export interface ActionAbilityContext {
  type: "action-ability";
  activatedByPlayer: PlayerId;
  /** Index of the ability for cards with multiple action abilities. Defaults to 0. */
  abilityIndex: number;
  /**
   * For leader cards: true = deployed unit side, false = non-deployed leader side.
   * For non-leader unit cards this is always false.
   */
  deployed: boolean;
}

export type TriggerContext =
  | WhenPlayedContext
  | WhenCardPlayedContext
  | WhenOpponentCardPlayedContext
  | WhenDeployedContext
  | WhenDefeatedContext
  | WhenFriendlyUnitDefeatedContext
  | WhenEnemyUnitDefeatedContext
  | WhenFriendlyUnitDamagedContext
  | WhenEnemyUnitDamagedContext
  | ActionAbilityContext;

// ---------------------------------------------------------------------------
// Trigger Entry — lives in GameState.triggerBag; must be JSON-serializable
// ---------------------------------------------------------------------------

export interface TriggerEntry {
  /** Unique identifier for this pending trigger instance */
  triggerId: string;
  triggerType: TriggerType;
  /** cardId of the card whose ability is triggering */
  sourceCardId: string;
  /** playId of the unit/card in play whose ability is triggering */
  sourcePlayId: string;
  /** player that controls the triggering card */
  owner: PlayerId;
  /** serializable context describing the event that caused this trigger */
  context: TriggerContext;
}

// ---------------------------------------------------------------------------
// Game Effects — produced when a TriggerEntry resolves.
// NOTE: Effects requiring player choice (target selection) need a separate
// "pending-choice" mechanism. These represent deterministic effects only.
// TODO: expand as card abilities are implemented.
// ---------------------------------------------------------------------------

export type GameEffect =
  | { type: "deal-damage"; targetPlayId: string; amount: number }
  | { type: "deal-base-damage"; targetPlayer: PlayerId; amount: number }
  | { type: "heal-damage"; targetPlayId: string; amount: number }
  | { type: "draw-cards"; player: PlayerId; count: number }
  | { type: "gain-resource"; player: PlayerId; count: number; ready: boolean }
  | { type: "defeat-unit"; targetPlayId: string }
  | { type: "exhaust-unit"; targetPlayId: string }
  | { type: "ready-unit"; targetPlayId: string }
  | { type: "return-to-hand"; targetPlayId: string }
  | { type: "discard-from-hand"; player: PlayerId; cardId: string }
  | { type: "give-experience"; targetPlayId: string }
  | { type: "capture-unit"; captorPlayId: string; targetPlayId: string }
  | { type: "grant-sentinel"; targetPlayId: string; duration: "phase" | "round" | "permanent" }
  | { type: "grant-shield"; targetPlayId: string }
  | { type: "no-op" };
