import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { Game, GameState } from "@/lib/engine/game";
import type { GameDispatch, ResolutionRequest } from "@/lib/engine/message-types";
import type { EngineContext } from "@/server/engine/pending-resolution";
import { getTopLevelActions, getResolutionActions } from "./actions";
import { formatStep } from "./format";

const MAX_DISPATCHES = 500;
const DEFAULT_TIMEOUT_MS = 55_000; // 5s buffer before the API-level 60s deadline

export interface SolverResult {
  solvable: boolean;
  steps: string[][];
  timedOut?: boolean;
}

function buildInitialContext(gs: GameState): EngineContext {
  const game: Game = {
    id: randomUUID(),
    currentGameState: gs,
    gameStateHistory: [],
    gameLog: [],
  };
  return { game, pending: null };
}

function isWon(gs: GameState): boolean {
  return gs.defeatedPlayers.includes(2);
}

function isLost(gs: GameState): boolean {
  return gs.defeatedPlayers.includes(1);
}

/**
 * Returns true if the game has left the ActionPhase.
 * The solver only explores within a single action phase — cross-round play is
 * not considered a valid puzzle solution (empty-deck damage accumulates over
 * multiple rounds and would give false positives on "unsolvable" puzzles).
 */
function isPhaseTerminal(gs: GameState): boolean {
  return gs.gamePhase !== "ActionPhase";
}

// Include the pending resolution in the key so that states mid-resolution
// (e.g. "4-LOM initiated attack, waiting for target choice") are distinct
// from the pre-action state. Without this, initiate-attack produces no
// observable GameState change (attacker is not exhausted until resolveAttack),
// so the post-dispatch state collides with the pre-dispatch state in the
// visited set and all attack paths from that node get incorrectly pruned.
//
// cardsPlayedThisRound grows O(n) with each card played and would make each
// sequence of plays unique, exploding the state space. Replace it with a
// compact summary: for each player, whether they've played their first event
// this round (the only bit Relentless needs). All other cardsPlayedThisRound
// info is derivable from the rest of gs (discard, arenas, resources).
function stateKey(gs: GameState, pending: unknown): string {
  const { roundState: { cardsPlayedThisRound, ...roundRest }, ...gsRest } = gs;
  const firstEventPlayed = [1, 2].map(p =>
    cardsPlayedThisRound.some(e => e.fromPlayer === p && e.playedAs === "Event"),
  );
  return JSON.stringify({ gs: { ...gsRest, roundState: { ...roundRest, _fep: firstEventPlayed } }, p: pending });
}


// Returns true when the first solution is found so callers can stop immediately.
function dfs(
  context: EngineContext,
  resolution: ResolutionRequest | null,
  path: Array<{ dispatch: GameDispatch; snapshot: GameState }>,
  solutionPaths: string[][],
  visited: Set<string>,
  deadline: number,
  depth: number,
): boolean {
  if (Date.now() > deadline) return false;
  if (depth > MAX_DISPATCHES) return false;

  const gs = context.game.currentGameState;

  if (isWon(gs)) {
    solutionPaths.push(path.map(({ dispatch, snapshot }) => formatStep(dispatch, snapshot)));
    return true;
  }

  if (isLost(gs)) return false;

  // Stop exploring when the action phase ends without a win. Puzzles are
  // solved within a single action phase — continuing across round boundaries
  // causes false positives from empty-deck base damage accumulating over time.
  if (isPhaseTerminal(gs)) return false;

  const actions = resolution
    ? getResolutionActions(resolution, gs)
    : getTopLevelActions(gs);

  // NOTE: NeedsPlayer and NeedsTrigger resolutions are not yet implemented in the engine
  // (dispatch-listener.ts returns invalidAction for choose-player and choose-trigger).
  // If a puzzle requires one of these resolutions, the solver will dead-end and return
  // solvable: false even when a winning line exists. Add support when the engine implements them.
  for (const action of actions) {
    if (Date.now() > deadline) return false;

    const result = processPuzzleDispatch(action, context);
    if (result.response.invalidAction) continue;

    // Strip history to prevent O(depth²) clone growth — solver never reads it
    const trimmedContext: EngineContext = {
      ...result.context,
      game: { ...result.context.game, gameStateHistory: [] },
    };

    const newGs = trimmedContext.game.currentGameState;
    const newResolution = (result.response.resolutionNeeded as ResolutionRequest | undefined) ?? null;
    const key = stateKey(newGs, newResolution);
    if (visited.has(key)) continue;
    visited.add(key);

    if (
      dfs(
        trimmedContext,
        newResolution,
        [...path, { dispatch: action, snapshot: gs }],
        solutionPaths,
        visited,
        deadline,
        depth + 1,
      )
    ) {
      return true;
    }
  }

  return false;
}

export function solve(rawPuzzle: RawPuzzleGameState, timeoutMs = DEFAULT_TIMEOUT_MS): SolverResult {
  const deadline = Date.now() + timeoutMs;
  const gs = hydratePuzzleGame(rawPuzzle);
  const context = buildInitialContext(gs);

  const solutionPaths: string[][] = [];
  const visited = new Set<string>([stateKey(gs, null)]);

  dfs(context, null, [], solutionPaths, visited, deadline, 0);

  const timedOut = Date.now() > deadline;

  return {
    solvable: solutionPaths.length > 0,
    steps: solutionPaths,
    ...(timedOut ? { timedOut: true } : {}),
  };
}
