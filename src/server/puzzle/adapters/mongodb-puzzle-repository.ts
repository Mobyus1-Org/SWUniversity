import { connectToDatabase } from "@/server/db";
import { PuzzleModel } from "@/server/models/Puzzle";
import type { PuzzleRepository, PuzzleData } from "../puzzle-repository";
import type { RawPuzzleGameState } from "./puzzle-runtime";

export class MongoDBPuzzleRepository implements PuzzleRepository {
  private async connect() {
    await connectToDatabase();
  }

  async list(showAll = false): Promise<PuzzleData[]> {
    await this.connect();
    const docs = await PuzzleModel.find().lean();
    return docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description ?? "",
      difficulty: doc.difficulty,
      initialGamestate: doc.initialGamestate as RawPuzzleGameState,
      deploy: doc.deploy,
      author: doc.author ?? "",
      inspiredBy: doc.inspiredBy,
      intendedSolution: doc.intendedSolution ?? [],
    }))
    .filter((p) => showAll || p.deploy);
  }

  async load(id: string): Promise<RawPuzzleGameState> {
    await this.connect();
    const doc = await PuzzleModel.findById(id).lean();
    if (!doc) throw new Error(`Puzzle "${id}" not found.`);
    return doc.initialGamestate as RawPuzzleGameState;
  }

  async save(puzzle: PuzzleData): Promise<PuzzleData> {
    await this.connect();

    if (puzzle.id) {
      const doc = await PuzzleModel.findByIdAndUpdate(
        puzzle.id,
        {
          name: puzzle.name,
          description: puzzle.description,
          difficulty: puzzle.difficulty,
          initialGamestate: puzzle.initialGamestate,
          author: puzzle.author ?? "",
          inspiredBy: puzzle.inspiredBy,
          intendedSolution: puzzle.intendedSolution ?? [],
        },
        { new: true, lean: true },
      );
      if (!doc) throw new Error(`Puzzle "${puzzle.id}" not found.`);
      return { ...puzzle, id: doc._id.toString() };
    }

    const doc = await PuzzleModel.create({
      name: puzzle.name,
      description: puzzle.description,
      difficulty: puzzle.difficulty,
      initialGamestate: puzzle.initialGamestate,
      author: puzzle.author ?? "",
      inspiredBy: puzzle.inspiredBy,
      intendedSolution: puzzle.intendedSolution ?? [],
    });
    return { ...puzzle, id: doc._id.toString() };
  }
}
