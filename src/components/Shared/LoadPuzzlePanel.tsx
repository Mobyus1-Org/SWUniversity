import React from "react";
import { globalBackgroundStyle } from "@/util/style-const";

type PuzzleEntry = { id: string; name: string; description: string; difficulty: number };

type Props = {
  onPuzzleLoaded: (id: string, meta: { name: string; description: string; difficulty: number }) => void;
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

export function LoadPuzzlePanel({ onPuzzleLoaded }: Props) {
  const [puzzles, setPuzzles] = React.useState<PuzzleEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<SortKey>("difficulty");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  React.useEffect(() => {
    fetch("/api/puzzles")
      .then((r) => r.json())
      .then((data: { puzzles: PuzzleEntry[] }) => setPuzzles(data.puzzles))
      .catch(() => setError("Failed to list puzzles."))
      .finally(() => setLoading(false));
  }, []);

  function handleLoad(entry: PuzzleEntry) {
    setSelectedId(null);
    onPuzzleLoaded(entry.id, { name: entry.name, description: entry.description, difficulty: entry.difficulty });
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
        <ul className="h-128 space-y-2 overflow-y-auto pr-1">
          {sortedPuzzles.map((entry) => {
            const { id, name, description, difficulty } = entry;
            const isSelected = selectedId === id;
            return (
              <li
                key={id}
                onClick={() => setSelectedId(isSelected ? null : id)}
                className={`group ${globalBackgroundStyle} border rounded cursor-pointer p-3 flex flex-col gap-1 transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold truncate">{name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleLoad(entry); }}
                    className={[
                      "btn btn-primary btn-sm shrink-0",
                      // mobile: only show when selected
                      isSelected ? "" : "max-lg:hidden",
                      // desktop: invisible by default, fade in on row hover
                      "lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-150",
                    ].join(" ")}
                  >
                    Load
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm opacity-70">
                  <DifficultyDots value={difficulty} />
                  {description ? <span className="truncate">{description}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
