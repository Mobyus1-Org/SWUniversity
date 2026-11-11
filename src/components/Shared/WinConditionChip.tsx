import { WIN_CONDITION_INFO } from "@/util/puzzle-win-condition";
import type { PuzzleWinCondition } from "@/util/puzzle-win-condition";

// Each mode has its own colour so the list can be scanned by goal at a glance. Full class strings,
// not interpolated, so Tailwind's scanner keeps them.
const CHIP_COLORS: Record<PuzzleWinCondition, string> = {
  "deal-lethal": "border-blue-400/40 bg-blue-500/20 text-blue-200",
  "clear-board": "border-yellow-400/40 bg-yellow-500/20 text-yellow-200",
  "heal-full": "border-green-400/40 bg-green-500/20 text-green-200",
  "self-lethal": "border-red-400/40 bg-red-500/20 text-red-200",
};

/** The puzzle-mode bubble shown beside a puzzle's name. */
export function WinConditionChip({ winCondition, className = "text-3xs" }: { winCondition: PuzzleWinCondition; className?: string }) {
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${CHIP_COLORS[winCondition]} ${className}`}>
      {WIN_CONDITION_INFO[winCondition].title}
    </span>
  );
}
