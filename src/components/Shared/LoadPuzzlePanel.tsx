import React from "react";
import { globalBackgroundStyle } from "@/util/style-const";
import { puzzleImageSrc, DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { PuzzleStatus } from "@/server/puzzle/puzzle-status";

type PuzzleEntry = { id: string; name: string; description: string; infoText: string; difficulty: number; author: string; inspiredBy?: string; intendedSolution: string[]; hints: string[]; status: PuzzleStatus; assetPath?: string; initialGamestate: RawPuzzleGameState };

type Props = {
  onPuzzleLoaded: (id: string, meta: PuzzleEntry) => void;
  onEditPuzzle?: (entry: PuzzleEntry) => void;
  isAdmin?: boolean;
  solvedPuzzleIds?: string[];
  /** Bump to force a re-fetch of the puzzle list (e.g. after a save/edit). */
  refreshSignal?: number;
};

function DifficultyDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const isFull = value - i >= 1;
        return (
          <span key={i} className="relative inline-block h-6 w-6 rounded-full bg-white/20 overflow-hidden">
            {isFull && <span className="absolute inset-0 bg-primary" />}
          </span>
        );
      })}
    </span>
  );
}

type SortKey = "title" | "difficulty";
type SortDir = "asc" | "desc";
type SolvedFilter = "all" | "solved" | "unsolved";
// Admin-only: filter the list by visibility status.
type StatusFilter = "all" | "hidden" | "test" | "deployed";

const DIFFICULTIES = [1, 2, 3, 4, 5] as const;

// Tutorial puzzle pinned to the top of the Difficulty-sorted list (matched by exact title).
// Only reorders puzzles already visible, so it disappears when its difficulty tier is filtered out.
const PINNED_TUTORIAL_TITLE = "We Have to Start Somewhere";

/**
 * Difficulty filter: one toggle per tier, so non-contiguous picks like "1 and 3" are possible.
 *
 * This replaced a two-thumb range slider. Both thumbs shared one track, and the max thumb — being
 * painted on top — captured every drag; once min and max met at 5 the only draggable thumb was one
 * that refused to go below min, leaving the filter stuck.
 *
 * Nothing selected is the default and means "not filtering by difficulty": every puzzle shows and
 * no button is lit. So picking a single tier is one click, and the lit buttons always read as
 * exactly the tiers being filtered to.
 */
function DifficultyFilter({ selected, onToggle }: { selected: Set<number>; onToggle: (value: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Diff</span>
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={selected.has(d)}
            aria-label={`Difficulty ${d}`}
            onClick={() => onToggle(d)}
            className={`rounded px-2 py-0.5 font-medium tabular-nums transition-colors ${selected.has(d) ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoadPuzzlePanel(props: Props) {
  const { onPuzzleLoaded, onEditPuzzle, isAdmin = false, solvedPuzzleIds = [], refreshSignal } = props;
  const [puzzles, setPuzzles] = React.useState<PuzzleEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<SortKey>("difficulty");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [solvedFilter, setSolvedFilter] = React.useState<SolvedFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  // Empty = no difficulty filtering (every tier shows). See DifficultyFilter.
  const [diffSelected, setDiffSelected] = React.useState<Set<number>>(() => new Set());

  const toggleDifficulty = React.useCallback((value: number) => {
    setDiffSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const fetchList = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/puzzles")
      .then((r) => r.json())
      .then((data: { puzzles: PuzzleEntry[] }) => setPuzzles(data.puzzles))
      .catch(() => setError("Failed to list puzzles."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);

  async function setPuzzleStatus(id: string, status: PuzzleStatus) {
    try {
      setLoading(true);
      const res = await fetch("/api/puzzles/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchList();
    } catch (err) {
      setError("Failed to update puzzle status.");
    } finally {
      setLoading(false);
    }
  }

  function handleLoad(entry: PuzzleEntry) {
    onPuzzleLoaded(entry.id, entry);
  }

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filteredPuzzles = puzzles.filter((p) => {
    const isSolved = solvedPuzzleIds.includes(p.id);
    if (solvedFilter === "solved" && !isSolved) return false;
    if (solvedFilter === "unsolved" && isSolved) return false;
    // Admin-only status filter; ignored entirely for non-admins.
    if (isAdmin && statusFilter !== "all" && p.status !== statusFilter) return false;
    if (diffSelected.size > 0 && !diffSelected.has(p.difficulty)) return false;
    return true;
  });

  const sortedPuzzles = [...filteredPuzzles].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "title") return mul * a.name.localeCompare(b.name);
    // Difficulty sort: the tutorial puzzle is pinned to the very top (either direction);
    // then by difficulty (respecting the chosen direction); ties break by Title ascending.
    // The pin only reorders the already-filtered list, so hiding its difficulty tier removes it.
    const aPin = a.name === PINNED_TUTORIAL_TITLE ? 0 : 1;
    const bPin = b.name === PINNED_TUTORIAL_TITLE ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;
    return mul * (a.difficulty - b.difficulty) || a.name.localeCompare(b.name);
  });

  const sortLabel = (key: SortKey) => {
    if (sortKey !== key) return key === "title" ? "Title" : "Difficulty";
    return `${key === "title" ? "Title" : "Difficulty"} ${sortDir === "asc" ? "↑" : "↓"}`;
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest">Puzzles</p>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
          {(["difficulty", "title"] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSortClick(key)}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${sortKey === key ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"}`}
            >
              {sortLabel(key)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
          {(["all", "solved", "unsolved"] as SolvedFilter[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSolvedFilter(v)}
              className={`rounded px-2 py-0.5 font-medium capitalize transition-colors ${solvedFilter === v ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <DifficultyFilter selected={diffSelected} onToggle={toggleDifficulty} />
        {isAdmin ? (
          <div
            className="flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-0.5 text-xs"
            title="Admin only — filter by status"
          >
            {(["all", "hidden", "test", "deployed"] as StatusFilter[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setStatusFilter(v)}
                className={`rounded px-2 py-0.5 font-medium capitalize transition-colors ${statusFilter === v ? "bg-emerald-600/80 text-white" : "text-white/50 hover:text-white/80"}`}
              >
                {v}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {loading ? (
        <p className="text-sm opacity-60">Scanning…</p>
      ) : error ? (
        <p className="text-sm text-error">{error}</p>
      ) : puzzles.length === 0 ? (
        <p className="text-sm opacity-60">No puzzles found.</p>
      ) : sortedPuzzles.length === 0 ? (
        <p className="text-sm opacity-60">No puzzles match these filters.</p>
      ) : (
        <ul className="h-7/8 space-y-2 overflow-y-auto pr-1">
          {sortedPuzzles.map((entry) => {
            const { id, name, description, difficulty } = entry;
            return (
              <li
                key={id}
                onClick={() => handleLoad(entry)}
                className={`group ${globalBackgroundStyle} border rounded cursor-pointer p-3 flex gap-3 transition-all hover:ring-2 hover:ring-primary/60`}
              >
                <img
                  src={puzzleImageSrc(entry.assetPath)}
                  alt=""
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.src.endsWith(DEFAULT_PUZZLE_IMAGE)) img.src = `/assets/${DEFAULT_PUZZLE_IMAGE}`;
                  }}
                  className="h-16 w-16 shrink-0 self-center rounded border-2 border-white/80 bg-black/30 object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{name}</span>
                    {solvedPuzzleIds.includes(id) ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        ✓ Solved
                      </span>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <div className="ml-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {onEditPuzzle ? (
                        <button
                          type="button"
                          onClick={() => onEditPuzzle(entry)}
                          className="rounded-md border border-sky-400/30 bg-sky-500/15 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-sky-500/25"
                        >
                          Edit
                        </button>
                      ) : null}
                      <select
                        value={entry.status}
                        onChange={(e) => void setPuzzleStatus(id, e.target.value as PuzzleStatus)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Puzzle visibility status"
                        className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs font-semibold text-white/90 outline-none"
                      >
                        <option value="hidden">Hidden</option>
                        <option value="test">Test</option>
                        <option value="deployed">Deployed</option>
                      </select>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-sm opacity-70">
                  <DifficultyDots value={difficulty} />
                  {description ? <span className="truncate">{description}</span> : null}
                </div>
                {(entry.author || entry.inspiredBy) ? (
                  <div className="text-xs text-white/40 truncate">
                    {entry.author ? <span>By {entry.author}</span> : null}
                    {entry.author && entry.inspiredBy ? <span className="mx-1">·</span> : null}
                    {entry.inspiredBy ? <span>Inspired by {entry.inspiredBy}</span> : null}
                  </div>
                ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
