import { reducePuzzle, type PuzzleIntent, type PuzzleRuntime } from "@/lib/puzzles/engine";

export type EngineState = PuzzleRuntime;
export type EngineAction = PuzzleIntent;

export function resolveEngineAction(state: EngineState, action: EngineAction): EngineState {
  return reducePuzzle(state, action);
}
