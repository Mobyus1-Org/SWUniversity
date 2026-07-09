import React from "react";
import { globalBackgroundStyle } from "@/util/style-const";
import { puzzleImageSrc, DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";

type PuzzleEntry = { id: string; name: string; description: string; infoText: string; difficulty: number; author: string; inspiredBy?: string; intendedSolution: string[]; deploy?: boolean; assetPath?: string; initialGamestate: RawPuzzleGameState };

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
        const fill = Math.min(1, Math.max(0, value - i));
        const isHalf = fill > 0 && fill < 1;
        const isFull = fill >= 1;
        return (
          <span key={i} className="relative inline-block h-6 w-6 rounded-full bg-white/20 overflow-hidden">
            {isFull && <span className="absolute inset-0 bg-primary" />}
            {isHalf && <span className="absolute inset-0 right-1/2 bg-primary" />}
          </span>
        );
      })}
    </span>
  );
}

type SortKey = "title" | "difficulty";
type SortDir = "asc" | "desc";

export function LoadPuzzlePanel(props: Props) {
  const { onPuzzleLoaded, onEditPuzzle, isAdmin = false, solvedPuzzleIds = [], refreshSignal } = props;
  const [puzzles, setPuzzles] = React.useState<PuzzleEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<SortKey>("difficulty");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

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

  const sortedPuzzles = [...puzzles].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "title") return mul * a.name.localeCompare(b.name);
    return mul * (a.difficulty - b.difficulty);
  });

  const sortLabel = (key: SortKey) => {
    if (sortKey !== key) return key === "title" ? "Title" : "Difficulty";
    return `${key === "title" ? "Title" : "Difficulty"} ${sortDir === "asc" ? "↑" : "↓"}`;
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-3">
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
      </div>
      {loading ? (
        <p className="text-sm opacity-60">Scanning…</p>
      ) : error ? (
        <p className="text-sm text-error">{error}</p>
      ) : puzzles.length === 0 ? (
        <p className="text-sm opacity-60">No puzzles found.</p>
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
