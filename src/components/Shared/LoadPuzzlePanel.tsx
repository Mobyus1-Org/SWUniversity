import React from "react";
import { globalBackgroundStyle } from "@/util/style-const";
import { puzzleImageSrc, DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";

type PuzzleEntry = { id: string; name: string; description: string; infoText: string; difficulty: number; author: string; inspiredBy?: string; intendedSolution: string[]; hints: string[]; deploy?: boolean; assetPath?: string; initialGamestate: RawPuzzleGameState };

type Props = {
  onPuzzleLoaded: (id: string, meta: PuzzleEntry) => void;
  onEditPuzzle?: (entry: PuzzleEntry) => void;
  isAdmin?: boolean;
  solvedPuzzleIds?: string[];
  /** Bump to force a re-fetch of the puzzle list (e.g. after a save/edit). */
  refreshSignal?: number;
};

function DifficultyDots({ value }: { value: number }) {
  return (
    <img
      src={`/assets/puzzles/saber${value}.png`}
      alt={`Difficulty ${value}`}
      className="h-6 w-auto"
    />
  );
}

type SortKey = "title" | "difficulty";
type SortDir = "asc" | "desc";
type SolvedFilter = "all" | "solved" | "unsolved";
// Admin-only: filter the list by deploy status. Deployed = live, Hidden = not yet deployed.
type DeployFilter = "all" | "deployed" | "hidden";

const DIFF_LO = 1;
const DIFF_HI = 5;
const DIFF_STEP = 1;

// Tutorial puzzle pinned to the top of the Difficulty-sorted list (matched by exact title).
// Only reorders puzzles already visible, so it disappears when its difficulty tier is filtered out.
const PINNED_TUTORIAL_TITLE = "We Have to Start Somewhere";

const rangeThumbClass =
  "pointer-events-none absolute inset-0 h-6 w-full cursor-pointer appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/40 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow";

function DifficultyRange({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const pct = (v: number) => ((v - DIFF_LO) / (DIFF_HI - DIFF_LO)) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Diff</span>
      <span className="w-14 shrink-0 text-[11px] tabular-nums text-white/70">{min}–{max}</span>
      <div className="relative h-6 w-36">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15" />
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }}
        />
        <input
          type="range"
          aria-label="Minimum difficulty"
          min={DIFF_LO}
          max={DIFF_HI}
          step={DIFF_STEP}
          value={min}
          onChange={(e) => onChange(Math.min(Number(e.target.value), max), max)}
          className={rangeThumbClass}
        />
        <input
          type="range"
          aria-label="Maximum difficulty"
          min={DIFF_LO}
          max={DIFF_HI}
          step={DIFF_STEP}
          value={max}
          onChange={(e) => onChange(min, Math.max(Number(e.target.value), min))}
          className={rangeThumbClass}
        />
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
  const [deployFilter, setDeployFilter] = React.useState<DeployFilter>("all");
  const [diffMin, setDiffMin] = React.useState(DIFF_LO);
  const [diffMax, setDiffMax] = React.useState(DIFF_HI);

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

  async function toggleDeploy(id: string, current: boolean | undefined) {
    try {
      setLoading(true);
      const res = await fetch("/api/puzzles/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, deploy: !current }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchList();
    } catch (err) {
      setError("Failed to update deploy flag.");
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
    // Admin-only deploy filter; ignored entirely for non-admins.
    if (isAdmin) {
      if (deployFilter === "deployed" && !p.deploy) return false;
      if (deployFilter === "hidden" && p.deploy) return false;
    }
    if (p.difficulty < diffMin || p.difficulty > diffMax) return false;
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
        <DifficultyRange min={diffMin} max={diffMax} onChange={(lo, hi) => { setDiffMin(lo); setDiffMax(hi); }} />
        {isAdmin ? (
          <div
            className="flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-0.5 text-xs"
            title="Admin only — filter by deploy status"
          >
            {(["all", "deployed", "hidden"] as DeployFilter[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDeployFilter(v)}
                className={`rounded px-2 py-0.5 font-medium capitalize transition-colors ${deployFilter === v ? "bg-emerald-600/80 text-white" : "text-white/50 hover:text-white/80"}`}
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
                      <label
                        className="inline-flex items-center cursor-pointer"
                        aria-label={entry.deploy ? "Mark hidden" : "Mark deployed"}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(entry.deploy)}
                          onChange={() => void toggleDeploy(id, entry.deploy)}
                          className="sr-only"
                          aria-checked={Boolean(entry.deploy)}
                        />
                        <span className={`relative inline-block h-6 w-12 rounded-full transition-colors ${entry.deploy ? "bg-emerald-600" : "bg-white/10"}`}>
                          <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${entry.deploy ? "translate-x-6" : "translate-x-0"}`} />
                        </span>
                        <span className="ml-2 text-xs font-semibold text-white/90">{entry.deploy ? "Deployed" : "Hidden"}</span>
                      </label>
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
