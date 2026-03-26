import type { PuzzleIntent, PuzzleRuntime } from "@/lib/puzzles/types";
import { computePuzzleUiHints, withPuzzleGame, type PuzzleUiHints } from "./puzzle-bridge";
import { dispatchPuzzleAction } from "../actions";

export type EngineState = PuzzleRuntime;
export type EngineAction = PuzzleIntent;
export type { PuzzleUiHints };

export function resolveEngineAction(
  state: EngineState | undefined,
  action: EngineAction,
): { state: EngineState; ui: PuzzleUiHints } {
  if (!state?.game) {
    throw new Error("No active puzzle state.");
  }
  // Run dispatch with the singleton active so HasSentinel (and other
  // keyword functions) work correctly during action processing.
  const nextState: EngineState = withPuzzleGame(state.game, () => dispatchPuzzleAction(state, action));
  return { state: nextState, ui: computePuzzleUiHints(nextState) };
}
