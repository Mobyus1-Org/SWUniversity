/**
 * Core game model types — single source of truth.
 *
 * Plain serialisable interfaces and string-literal unions that every layer
 * (engine, puzzle adapter, client, tests) can import without pulling in
 * class-based server code.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type PlayerId = 1 | 2;

export type DiscardEffect = "" | "TTFREE" | "OTTFREE";

export type EffectDuration = "Phase" | "Round" | "Permanent" | "ForAttack" | "ForDefense" | "UntilStartOfRegroup";

export type GamePhase = "ActionPhase" | "RegroupDraw" | "RegroupResource" | "RegroupReady";

export type Zones = "Hand" | "Deck" | "Discard" | "SpaceArena" | "GroundArena" | "Base" | "Leader";

export type CardTypes = "Unit" | "Event" | "Upgrade" | "Leader" | "Base";

// ---------------------------------------------------------------------------
// Card interfaces
// ---------------------------------------------------------------------------

export interface Card {
  cardId: string;
}

export interface EpicActionCard extends Card {
  epicActionUsed: boolean;
}

export interface Base extends EpicActionCard {
  damage: number;
  numUses: number;
}

export interface Leader extends EpicActionCard {
  ready: boolean;
  deployed: boolean;
  deployedPlayId?: string;
}

export interface CardInPlay extends Card {
  playId: string;
  owner: PlayerId;
  controller: PlayerId;
}

export interface Unit extends CardInPlay {
  cardId: string;
  playId: string;
  controller: PlayerId;
  owner: PlayerId;
  ready: boolean;
  damage: number;
  upgrades: CardInPlay[];
  captives: Unit[];
  numUses: number;
  isClone: boolean;
  /** Regional Governor (SOR_062): card title opponents can't play while this unit is in play. */
  namedCardTitle?: string;
}

export interface Resource extends CardInPlay {
  ready: boolean;
  stolen: boolean;
}

export interface DiscardedCard extends CardInPlay {
  controller: PlayerId;
  turnDiscarded: number;
  discardEffect: DiscardEffect;
}

/**
 * Sentinel `cardId` for a generic "+X/+X (or –X/–X) for this phase" modifier. The amount
 * lives on the effect's `value`, so any card can push one without its own stat case.
 */
export const PHASE_STAT_MOD = "stat-mod";

/** Generic power-only modifier (+X/+0 or –X/–0). Unlike PHASE_STAT_MOD, it leaves HP alone. */
export const POWER_MOD = "power-mod";

/** Generic HP-only modifier (+0/+X or –0/–X). The counterpart of POWER_MOD: leaves power alone. */
export const HP_MOD = "hp-mod";

export interface CurrentEffect {
  cardId: string;
  duration: EffectDuration;
  affectedPlayer: PlayerId;
  targetPlayId?: string;
  /** Generic numeric payload — used to carry values like excess damage between trigger and resolution. */
  value?: number;
}
