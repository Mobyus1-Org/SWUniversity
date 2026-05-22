import { Schema, model, models, type Model } from "mongoose";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";

export type PuzzleDocument = {
  name: string;
  description: string;
  difficulty: number;
  initialGamestate: RawPuzzleGameState;
};

const puzzleSchema = new Schema<PuzzleDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    difficulty: { type: Number, required: true, min: 1.0, max: 5.0, set: (v: number) => parseFloat(String(v)) },
    initialGamestate: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const PuzzleModel =
  (models.Puzzle as Model<PuzzleDocument>) ||
  model<PuzzleDocument>("Puzzle", puzzleSchema);
