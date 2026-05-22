import path from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";

import type { PuzzleRepository, PuzzleData } from "../puzzle-repository";
import type { RawPuzzleGameState } from "./puzzle-runtime";

export class FilesystemPuzzleRepository implements PuzzleRepository {
  constructor(private readonly dir: string) {}

  async list(): Promise<PuzzleData[]> {
    const files = await readdir(this.dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

    const entries = await Promise.all(
      jsonFiles.map(async (filename): Promise<PuzzleData | null> => {
        try {
          const raw = JSON.parse(
            await readFile(path.join(this.dir, filename), "utf8"),
          ) as Record<string, unknown>;
          return {
            id: filename,
            name: typeof raw.name === "string" ? raw.name : filename,
            description: typeof raw.description === "string" ? raw.description : "",
            difficulty: Number(raw.difficulty ?? 1),
            initialGamestate: (raw.initialGamestate ?? raw) as RawPuzzleGameState,
          };
        } catch {
          return null;
        }
      }),
    );

    return entries.filter((e): e is PuzzleData => e !== null);
  }

  async load(id: string): Promise<RawPuzzleGameState> {
    this.validateId(id);
    const raw = JSON.parse(
      await readFile(path.join(this.dir, id), "utf8"),
    ) as Record<string, unknown>;
    return (raw.initialGamestate ?? raw) as RawPuzzleGameState;
  }

  async save(puzzle: PuzzleData): Promise<PuzzleData> {
    const id = puzzle.id || `puzzle-${Date.now()}.json`;
    this.validateId(id);
    const saved: PuzzleData = { ...puzzle, id };
    await writeFile(path.join(this.dir, id), JSON.stringify(saved, null, 2), "utf8");
    return saved;
  }

  private validateId(id: string): void {
    if (!id.endsWith(".json") || id.includes("/") || id.includes("..")) {
      throw new Error(`Invalid puzzle id: ${id}`);
    }
  }
}
