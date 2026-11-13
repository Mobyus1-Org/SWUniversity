import { Schema, model, models, type Model } from "mongoose";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { PuzzleStatus } from "@/server/puzzle/puzzle-status";
import { DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";
import { DEFAULT_WIN_CONDITION, PUZZLE_WIN_CONDITIONS } from "@/util/puzzle-win-condition";
import type { PuzzleWinCondition } from "@/util/puzzle-win-condition";

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
  /**
   * Shown when the puzzle fails by reaching the regroup phase rather than by base destruction.
   * Authored per-puzzle; there is deliberately no default — see the regroup-failure spec.
   */
  alternateFailExplanation?: string;
  /** Optional author note shown under the byline in the solved/solution dialog. */
  solutionComment?: string;
  /** What the player must do to win. Docs saved before goals existed read as "deal-lethal". */
  winCondition?: PuzzleWinCondition;
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
    alternateFailExplanation: { type: String, default: "" },
    solutionComment: { type: String, default: "" },
    winCondition: { type: String, enum: PUZZLE_WIN_CONDITIONS, default: DEFAULT_WIN_CONDITION },
    assetPath: { type: String, default: DEFAULT_PUZZLE_IMAGE },
  },
  { timestamps: true },
);

export const PuzzleModel =
  (models.Puzzle as Model<PuzzleDocument>) ||
  model<PuzzleDocument>("Puzzle", puzzleSchema);
