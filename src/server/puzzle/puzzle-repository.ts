import type { RawPuzzleGameState } from "./adapters/puzzle-runtime";

export type PuzzleData = {
  id: string;
  name: string;
  description: string;
  infoText: string;
  difficulty: number;
  initialGamestate: RawPuzzleGameState;
  deploy: boolean;
  author: string;
  inspiredBy?: string;
  intendedSolution: string[];
};

export interface PuzzleRepository {
  list(): Promise<PuzzleData[]>;
  load(id: string): Promise<RawPuzzleGameState>;
  save(puzzle: PuzzleData): Promise<PuzzleData>;
}
