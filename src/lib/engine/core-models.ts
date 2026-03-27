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

export type EffectDuration = "Phase" | "Round" | "Permanent" | "ForAttack" | "ForDefense";

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

export interface CurrentEffect {
  cardId: string;
  duration: EffectDuration;
  affectedPlayer: PlayerId;
  targetPlayId?: string;
}
