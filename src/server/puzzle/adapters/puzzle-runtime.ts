/**
 * Server-side puzzle runtime initialisation.
 *
 * Hydrates the raw test-puzzle JSON into a fully typed PuzzleRuntime ready
 * for the action dispatcher. Lives on the server because it reads from a
 * JSON data file and constructs the initial state that is persisted in the
 * API request/response cycle.
 */

import rawTestPuzzle from "@/server/_test-puzzles/test-puzzle.1.json";
import type {
  PlayerId,
  PuzzleDiscard,
  PuzzleGameState,
  PuzzleLeader,
  PuzzlePlayerState,
  PuzzleResource,
  PuzzleRuntime,
  PuzzleUnit,
  RawCard,
} from "@/lib/puzzles/types";

// ---------------------------------------------------------------------------
// Internal raw-shape types (mirrors the JSON schema of test-puzzle.json)
// ---------------------------------------------------------------------------

type RawBase = {
  cardId: string;
  epicActionUsed: boolean;
  damage: number;
};

type RawLeader = {
  cardId: string;
  epicActionUsed: boolean;
  ready: boolean;
  deployed: boolean;
};

type RawCardInPlay = {
  cardId: string;
  playId: string;
  owner: PlayerId;
  controller: PlayerId;
};

type RawUnit = RawCardInPlay & {
  ready: boolean;
  damage: number;
  upgrades: RawCardInPlay[];
  captives: RawUnit[];
};

type RawResource = RawCardInPlay & {
  ready: boolean;
};

type RawDiscard = RawCardInPlay & {
  turnDiscarded?: number;
  discardEffect?: "TTFREE" | "OTTFREE";
};

type RawPlayerState = {
  base: RawBase;
  leader: RawLeader;
  spaceArena: RawUnit[];
  groundArena: RawUnit[];
  resources: RawResource[];
  discard: RawDiscard[];
  deck: RawCard[];
  hand: RawCard[];
  supplemental: {
    forceToken?: boolean;
    creditTokens?: number;
  };
};

export type RawGameState = {
  activePlayer: PlayerId;
  defeatedPlayers?: PlayerId[];
  gamePhase: number;
  nextPlayId: number;
  player1: RawPlayerState;
  player2: RawPlayerState;
  currentEffects: Array<{
    cardId: string;
    duration?: number;
    affectedPlayer?: PlayerId;
    targetPlayId?: string;
  }>;
  currentRound: number;
  initiativePlayer: PlayerId;
  initiativeClaimed: boolean;
  triggerBag: unknown[];
};

// ---------------------------------------------------------------------------
// Hydration helpers (resolve "@" play-ID placeholders)
// ---------------------------------------------------------------------------

function cloneGame<T>(value: T): T {
  return structuredClone(value);
}

function hydrateUnit(unit: RawUnit, nextPlayIdRef: { value: number }): PuzzleUnit {
  const playId = unit.playId === "@" ? String(nextPlayIdRef.value++) : unit.playId;
  return {
    cardId: unit.cardId,
    playId,
    owner: unit.owner,
    controller: unit.controller,
    ready: unit.ready,
    damage: unit.damage,
    upgrades: unit.upgrades.map((upgrade) => ({
      ...upgrade,
      playId: upgrade.playId === "@" ? String(nextPlayIdRef.value++) : upgrade.playId,
    })),
    captives: unit.captives.map((captive) => hydrateUnit(captive, nextPlayIdRef)),
  };
}

function hydrateResource(
  resource: RawResource,
  nextPlayIdRef: { value: number },
): PuzzleResource {
  return {
    ...resource,
    playId: resource.playId === "@" ? String(nextPlayIdRef.value++) : resource.playId,
  };
}

function hydrateDiscard(
  card: RawDiscard,
  nextPlayIdRef: { value: number },
): PuzzleDiscard {
  return {
    ...card,
    playId: card.playId === "@" ? String(nextPlayIdRef.value++) : card.playId,
    controller: card.controller,
    turnDiscarded: card.turnDiscarded ?? 0,
    discardEffect: card.discardEffect ?? "TTFREE",
  };
}

function hydratePlayer(
  player: RawPlayerState,
  nextPlayIdRef: { value: number },
): PuzzlePlayerState {
  const leader: PuzzleLeader = {
    ...cloneGame(player.leader),
    deployedPlayId: undefined,
  };

  return {
    base: cloneGame(player.base),
    leader,
    spaceArena: player.spaceArena.map((unit) => hydrateUnit(unit, nextPlayIdRef)),
    groundArena: player.groundArena.map((unit) => hydrateUnit(unit, nextPlayIdRef)),
    resources: player.resources.map((resource) => hydrateResource(resource, nextPlayIdRef)),
    discard: player.discard.map((card) => hydrateDiscard(card, nextPlayIdRef)),
    deck: cloneGame(player.deck),
    hand: cloneGame(player.hand),
    supplemental: cloneGame(player.supplemental),
  };
}

export function hydrateGame(rawGame: RawGameState): PuzzleGameState {
  const nextPlayIdRef = { value: rawGame.nextPlayId };
  const player1 = hydratePlayer(rawGame.player1, nextPlayIdRef);
  const player2 = hydratePlayer(rawGame.player2, nextPlayIdRef);

  return {
    activePlayer: rawGame.activePlayer,
    defeatedPlayers: rawGame.defeatedPlayers ? cloneGame(rawGame.defeatedPlayers) : [],
    gamePhase: rawGame.gamePhase,
    nextPlayId: nextPlayIdRef.value,
    player1,
    player2,
    currentEffects: cloneGame(rawGame.currentEffects),
    currentRound: rawGame.currentRound,
    initiativePlayer: rawGame.initiativePlayer,
    initiativeClaimed: rawGame.initiativeClaimed,
    triggerBag: cloneGame(rawGame.triggerBag),
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createPuzzleRuntime(): PuzzleRuntime {
  const game = hydrateGame(rawTestPuzzle as RawGameState);

  return {
    game,
    history: [],
    log: [
      "Puzzle loaded.",
      "Opponent has already claimed the initiative.",
      "Click a hand card to play it, click your leader for ability/deploy, or click a ready friendly unit to attack.",
    ],
    status: "playing",
    prompt: null,
  };
}
