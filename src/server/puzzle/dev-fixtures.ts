import type { PuzzleData } from "@/server/puzzle/puzzle-repository";
import type { PuzzleAccessLevel } from "@/server/puzzle/puzzle-status";
import { puzzleStatusOf, isPuzzleVisibleTo } from "@/server/puzzle/puzzle-status";
import { DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";

/**
 * Dev-only sample puzzles appended to the list response so the status/visibility logic — and the
 * "Testing" chip — can be eyeballed without seeding the database.
 *
 * Each fixture is a raw doc carrying EITHER the new `status` field or the legacy `deploy` flag, so
 * it flows through the exact same `puzzleStatusOf()` + `isPuzzleVisibleTo()` path a real Mongo doc
 * would. Covers one of each status plus the two legacy `deploy: true/false` derivations.
 *
 * These are display-only: they exercise the landing list but are not loadable (no backing doc, so
 * clicking one 404s). Returns `[]` outside `NODE_ENV=development`.
 */
const DEV_FIXTURE_DOCS: Array<{
  id: string;
  label: string;
  status?: string;
  deploy?: boolean;
}> = [
  { id: "dev-status-hidden", label: "Status: Hidden", status: "hidden" },
  { id: "dev-status-test", label: "Status: Test", status: "test" },
  { id: "dev-status-deployed", label: "Status: Deployed", status: "deployed" },
  { id: "dev-legacy-deploy-true", label: "Legacy deploy: true", deploy: true },
  { id: "dev-legacy-deploy-false", label: "Legacy deploy: false", deploy: false },
];

export function devFixturePuzzles(level: PuzzleAccessLevel): PuzzleData[] {
  if (process.env.NODE_ENV !== "development") return [];
  return DEV_FIXTURE_DOCS
    .map((doc) => ({ doc, status: puzzleStatusOf(doc) }))
    .filter(({ status }) => isPuzzleVisibleTo(status, level))
    .map(({ doc, status }) => ({
      id: doc.id,
      name: `[dev] ${doc.label}`,
      description: "Dev-only sample puzzle for status/visibility testing.",
      infoText: "",
      difficulty: 1,
      initialGamestate: {},
      status,
      author: "dev fixtures",
      intendedSolution: [],
      hints: [],
      assetPath: DEFAULT_PUZZLE_IMAGE,
    }));
}
