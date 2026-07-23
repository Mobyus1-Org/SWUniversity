import type { RawPuzzleGameState } from "./adapters/puzzle-runtime";
import type { PuzzleStatus, PuzzleAccessLevel } from "@/server/puzzle/puzzle-status";

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
  /** Select-menu thumbnail, relative to public/assets/ (e.g. "puzzles/mandalore.png"). */
  assetPath?: string;
};

export interface PuzzleRepository {
  list(level: PuzzleAccessLevel): Promise<PuzzleData[]>;
  load(id: string): Promise<RawPuzzleGameState>;
  save(puzzle: PuzzleData): Promise<PuzzleData>;
}
