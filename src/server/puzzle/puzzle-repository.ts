import type { RawPuzzleGameState } from "./adapters/puzzle-runtime";

export type PuzzleData = {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  initialGamestate: RawPuzzleGameState;
};

export interface PuzzleRepository {
  list(): Promise<PuzzleData[]>;
  load(id: string): Promise<RawPuzzleGameState>;
  save(puzzle: PuzzleData): Promise<PuzzleData>;
}
