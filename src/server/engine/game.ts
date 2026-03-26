import { Base, Card, CurrentEffect, DiscardedCard, GamePhase, Leader, PlayerId, Resource } from "./core-models";
import { Unit } from "./unit";

export interface GameState {
  activePlayer: PlayerId;
  defeatedPlayers: PlayerId[];
  gamePhase: GamePhase;
  player1: {
    base: Base;
    leader: Leader;
    spaceArena: Unit[];
    groundArena: Unit[];
    resources: Resource[];
    discard: DiscardedCard[];
    deck: Card[];
    hand: Card[];
    supplemental: {
      forceToken?: boolean;
      creditTokens?: number;
    }
  };
  player2: {
    base: Base;
    leader: Leader;
    spaceArena: Unit[];
    groundArena: Unit[];
    resources: Resource[];
    discard: DiscardedCard[];
    deck: Card[];
    hand: Card[];
    supplemental: {
      forceToken?: boolean;
      creditTokens?: number;
    }
  };
  currentEffects: CurrentEffect[];
  currentRound: number;
  initiativePlayer: PlayerId;
  initiativeClaimed: boolean;
  roundState: {
    cardsPlayedThisPhase: { fromPlayer: PlayerId; cardId: string; playId: string }[];
    cardsDefeatedThisPhase: { fromPlayer: PlayerId; cardId: string; playId: string }[],
    unitsAttachedThisPhase: { fromPlayer: PlayerId; cardId: string; playId: string }[];
  },
}

export interface Game {
  currentGameState: GameState;
  gameStateHistory: GameState[];
  gameLog: string[];
}