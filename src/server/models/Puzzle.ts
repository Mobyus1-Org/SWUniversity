import { Schema, model, models, type Model } from "mongoose";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";

export type PuzzleDocument = {
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

const puzzleSchema = new Schema<PuzzleDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    infoText: { type: String, default: "" },
    difficulty: { type: Number, required: true, min: 1.0, max: 5.0, set: (v: number) => parseFloat(String(v)) },
    initialGamestate: { type: Schema.Types.Mixed, required: true },
    deploy: { type: Boolean, default: false },
    author: { type: String, default: "" },
    inspiredBy: { type: String },
    intendedSolution: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const PuzzleModel =
  (models.Puzzle as Model<PuzzleDocument>) ||
  model<PuzzleDocument>("Puzzle", puzzleSchema);
