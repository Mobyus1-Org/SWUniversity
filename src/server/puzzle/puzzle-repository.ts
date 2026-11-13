import type { RawPuzzleGameState } from "./adapters/puzzle-runtime";
import type { PuzzleStatus, PuzzleAccessLevel } from "@/server/puzzle/puzzle-status";
import type { PuzzleWinCondition } from "@/util/puzzle-win-condition";

export type PuzzleData = {
  id: string;
  name: string;
  description: string;
  infoText: string;
  difficulty: number;
  initialGamestate: RawPuzzleGameState;
  status: PuzzleStatus;
  author: string;
  inspiredBy?: string;
  intendedSolution: string[];
  hints: string[];
  /** Why the puzzle is lost once it reaches the regroup phase (see regroup-failure spec). */
  alternateFailExplanation?: string;
  /** Optional author note shown under the byline in the solved/solution dialog. */
  solutionComment?: string;
  /** What the player must do to win; absent means "deal-lethal". */
  winCondition?: PuzzleWinCondition;
  /** Select-menu thumbnail, relative to public/assets/ (e.g. "puzzles/mandalore.png"). */
  assetPath?: string;
};

export interface PuzzleRepository {
  list(level: PuzzleAccessLevel): Promise<PuzzleData[]>;
  load(id: string): Promise<RawPuzzleGameState>;
  save(puzzle: PuzzleData): Promise<PuzzleData>;
}
