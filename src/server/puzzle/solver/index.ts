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
const TIMEOUT_MS = 55_000; // 5s buffer before the API-level 60s deadline

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

function stateKey(gs: GameState): string {
  return JSON.stringify(gs);
}

function canonicalize(steps: string[]): string {
  return JSON.stringify([...steps].sort());
}

function dfs(
  context: EngineContext,
  resolution: ResolutionRequest | null,
  path: Array<{ dispatch: GameDispatch; snapshot: GameState }>,
  solutions: Set<string>,
  solutionPaths: string[][],
  visited: Set<string>,
  deadline: number,
  depth: number,
): void {
  if (Date.now() > deadline) return;
  if (depth > MAX_DISPATCHES) return;

  const gs = context.game.currentGameState;

  if (isWon(gs)) {
    const steps = path.map(({ dispatch, snapshot }) => formatStep(dispatch, snapshot));
    const key = canonicalize(steps);
    if (!solutions.has(key)) {
      solutions.add(key);
      solutionPaths.push(steps);
    }
    return;
  }

  if (isLost(gs)) return;

  // Stop exploring when the action phase ends without a win. Puzzles are
  // solved within a single action phase — continuing across round boundaries
  // causes false positives from empty-deck base damage accumulating over time.
  if (isPhaseTerminal(gs)) return;

  const actions = resolution
    ? getResolutionActions(resolution, gs)
    : getTopLevelActions(gs);

  // NOTE: NeedsPlayer and NeedsTrigger resolutions are not yet implemented in the engine
  // (dispatch-listener.ts returns invalidAction for choose-player and choose-trigger).
  // If a puzzle requires one of these resolutions, the solver will dead-end and return
  // solvable: false even when a winning line exists. Add support when the engine implements them.
  for (const action of actions) {
    if (Date.now() > deadline) return;

    const result = processPuzzleDispatch(action, context);
    if (result.response.invalidAction) continue;

    // Strip history to prevent O(depth²) clone growth — solver never reads it
    const trimmedContext: EngineContext = {
      ...result.context,
      game: { ...result.context.game, gameStateHistory: [] },
    };

    const newGs = trimmedContext.game.currentGameState;
    const key = stateKey(newGs);
    if (visited.has(key)) continue;
    visited.add(key);

    const newResolution = (result.response.resolutionNeeded as ResolutionRequest | undefined) ?? null;

    dfs(
      trimmedContext,
      newResolution,
      [...path, { dispatch: action, snapshot: gs }],
      solutions,
      solutionPaths,
      visited,
      deadline,
      depth + 1,
    );
  }
}

export function solve(rawPuzzle: RawPuzzleGameState): SolverResult {
  const deadline = Date.now() + TIMEOUT_MS;
  const gs = hydratePuzzleGame(rawPuzzle);
  const context = buildInitialContext(gs);

  const solutions = new Set<string>();
  const solutionPaths: string[][] = [];
  const visited = new Set<string>([stateKey(gs)]);

  dfs(context, null, [], solutions, solutionPaths, visited, deadline, 0);

  const timedOut = Date.now() > deadline;

  return {
    solvable: solutionPaths.length > 0,
    steps: solutionPaths,
    ...(timedOut ? { timedOut: true } : {}),
  };
}
