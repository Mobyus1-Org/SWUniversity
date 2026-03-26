export interface Card {
  cardId: string;
}

export interface EpicActionCard extends Card {
  epicActionUsed: boolean;
}

export interface CardInPlay extends Card {
  playId: string;
  owner: PlayerId;
}

export interface Base extends EpicActionCard {
  damage: number;
  numUses: number;
}

export interface Leader extends EpicActionCard {
  ready: boolean;
  deployed: boolean;
}

export interface Resource extends CardInPlay {
  ready: boolean;
  stolen: boolean;
}

export enum DiscardEffect {
  TTFREE,
  OTTFREE,
}

export interface DiscardedCard extends CardInPlay {
  turnDiscarded: number;
  discardEffect: DiscardEffect;
}

export enum EffectDuration {
  Phase,
  Round,
  Permanent,
}

export enum PlayerId {
  Player1 = 1,
  Player2 = 2
}

export interface CurrentEffect {
  cardId: string;
  duration: EffectDuration;
  affectedPlayer: PlayerId;
  targetPlayId?: string;
}

export enum GamePhase {
  ActionPhase,
  RegroupDraw,
  RegroupResource,
  RegroupReady,
}

export enum Zones {
  Hand,
  Deck,
  Discard,
  SpaceArena,
  GroundArena,
  Base,
  Leader,
}

export enum CardTypes {
  Unit = "Unit",
  Event = "Event",
  Upgrade = "Upgrade",
  Leader = "Leader",
  Base = "Base",
}