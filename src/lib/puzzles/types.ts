/**
 * Shared puzzle type definitions.
 *
 * Fully self-contained — no imports from the server engine. These are plain
 * serialisable shapes that travel over the wire as JSON. The server engine
 * adapters (puzzle-bridge.ts) are responsible for mapping between these types
 * and the class-based engine models.
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

export type PlayerId = 1 | 2;
export type PuzzleStatus = "playing" | "won" | "lost" | "draw";

// ---------------------------------------------------------------------------
// Raw data-layer types (used internally by the hydration layer and as JSON
// shape for deck / hand cards)
// ---------------------------------------------------------------------------

export type RawCard = {
  cardId: string;
};

// ---------------------------------------------------------------------------
// Public card-in-play types
// ---------------------------------------------------------------------------

export type PuzzleBase = {
  cardId: string;
  epicActionUsed: boolean;
  damage: number;
  numUses: number;
};

export type PuzzleLeader = {
  cardId: string;
  epicActionUsed: boolean;
  ready: boolean;
  deployed: boolean;
  deployedPlayId?: string;
};

export type PuzzleAttachment = {
  cardId: string;
  playId: string;
  owner: PlayerId;
  controller: PlayerId;
};

export type PuzzleUnit = {
  cardId: string;
  playId: string;
  owner: PlayerId;
  controller: PlayerId;
  ready: boolean;
  damage: number;
  upgrades: PuzzleAttachment[];
  captives: PuzzleUnit[];
  linkedLeader?: boolean;
};

export type PuzzleResource = {
  cardId: string;
  playId: string;
  owner: PlayerId;
  controller: PlayerId;
  ready: boolean;
};

export type PuzzleDiscard = {
  cardId: string;
  playId: string;
  owner: PlayerId;
  controller: PlayerId;
  turnDiscarded: number;
  discardEffect: "TTFREE" | "OTTFREE";
};

// ---------------------------------------------------------------------------
// Player + game state
// ---------------------------------------------------------------------------

export type PuzzlePlayerState = {
  base: PuzzleBase;
  leader: PuzzleLeader;
  spaceArena: PuzzleUnit[];
  groundArena: PuzzleUnit[];
  resources: PuzzleResource[];
  discard: PuzzleDiscard[];
  deck: RawCard[];
  hand: RawCard[];
  supplemental: {
    forceToken?: boolean;
    creditTokens?: number;
  };
  lastActionWasPass?: boolean;
};

export type PuzzleGameState = {
  activePlayer: PlayerId;
  defeatedPlayers: PlayerId[];
  gamePhase: number;
  currentRound: number;
  initiativePlayer: PlayerId;
  initiativeClaimed: boolean;
  nextPlayId: number;
  player1: PuzzlePlayerState;
  player2: PuzzlePlayerState;
  currentEffects: Array<{
    cardId: string;
    duration?: number;
    affectedPlayer?: PlayerId;
    targetPlayId?: string;
  }>;
  triggerBag: unknown[];
};

// ---------------------------------------------------------------------------
// Prompt / runtime / intent
// ---------------------------------------------------------------------------

export type AttackSource =
  | "normal-attack"
  | "precision-fire"
  | "rebel-assault-1"
  | "rebel-assault-2"
  | "heroic-sacrifice";

export type PuzzlePrompt =
  | {
      kind: "leader-choice";
      title: string;
      player: PlayerId;
      options: Array<"ability" | "deploy">;
    }
  | {
      kind: "hammerhead-target";
      title: string;
      unitPlayId: string;
      damage: number;
    }
  | {
      kind: "attack-attacker";
      title: string;
      source: AttackSource;
      powerBonus: number;
      saboteur: boolean;
      defeatAfterCombatDamage: boolean;
      attackerTrait?: string;
      mustBeDifferentFrom?: string;
    }
  | {
      kind: "attack-target";
      title: string;
      source: AttackSource;
      attackerPlayId: string;
      powerBonus: number;
      saboteur: boolean;
      defeatAfterCombatDamage: boolean;
      mustBeDifferentFrom?: string;
    }
  | {
      kind: "k2so-choice";
      title: string;
      targetPlayer: PlayerId;
    };

export type RuntimeSnapshot = {
  game: PuzzleGameState;
  log: string[];
  status: PuzzleStatus;
  prompt: PuzzlePrompt | null;
};

export type PuzzleRuntime = {
  game: PuzzleGameState;
  history: RuntimeSnapshot[];
  log: string[];
  status: PuzzleStatus;
  prompt: PuzzlePrompt | null;
};

export type PuzzleIntent =
  | { type: "click-hand"; handIndex: number }
  | { type: "click-unit"; playId: string }
  | { type: "click-base"; player: PlayerId }
  | { type: "click-leader"; player: PlayerId }
  | { type: "choose-option"; optionId: string }
  | { type: "pass" }
  | { type: "take-initiative" }
  | { type: "undo" }
  | { type: "reset" };
