import { Schema, model, models, type Model } from "mongoose";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { PuzzleStatus } from "@/server/puzzle/puzzle-status";
import { DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";

export type PuzzleDocument = {
  name: string;
  description: string;
  infoText: string;
  difficulty: number;
  initialGamestate: RawPuzzleGameState;
  /** @deprecated superseded by `status`; kept for back-compat reads of old docs. */
  deploy?: boolean;
  status?: PuzzleStatus;
  author: string;
  inspiredBy?: string;
  intendedSolution: string[];
  hints: string[];
  /** Select-menu thumbnail, relative to public/assets/ (e.g. "puzzles/mandalore.png"). */
  assetPath: string;
};

const puzzleSchema = new Schema<PuzzleDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    infoText: { type: String, default: "" },
    difficulty: { type: Number, required: true, min: 1, max: 5, set: (v: number) => Math.round(parseFloat(String(v))) },
    initialGamestate: { type: Schema.Types.Mixed, required: true },
    deploy: { type: Boolean }, // deprecated — no longer written
    status: { type: String, enum: ["hidden", "test", "deployed"], default: "hidden" },
    author: { type: String, default: "" },
    inspiredBy: { type: String },
    intendedSolution: { type: [String], default: [] },
    hints: { type: [String], default: [] },
    assetPath: { type: String, default: DEFAULT_PUZZLE_IMAGE },
  },
  { timestamps: true },
);

export const PuzzleModel =
  (models.Puzzle as Model<PuzzleDocument>) ||
  model<PuzzleDocument>("Puzzle", puzzleSchema);
