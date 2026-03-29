import React from "react";

type PuzzleEntry = { n: number; filename: string };

type Props = {
  onPuzzleLoaded: (n: number) => void;
};

export function LoadPuzzlePanel({ onPuzzleLoaded }: Props) {
  const [puzzles, setPuzzles] = React.useState<PuzzleEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedN, setSelectedN] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/internal/test-puzzles")
      .then((r) => r.json())
      .then((data: { puzzles: PuzzleEntry[] }) => setPuzzles(data.puzzles))
      .catch(() => setError("Failed to list puzzles."))
      .finally(() => setLoading(false));
  }, []);

  function handleLoad(n: number) {
    setSelectedN(null);
    onPuzzleLoaded(n);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">Puzzles</p>
      {loading ? (
        <p className="text-xs text-white/40">Scanning…</p>
      ) : puzzles.length === 0 ? (
        <p className="text-xs text-white/40">No saved puzzles found.</p>
      ) : (
        <ul className="max-h-36 space-y-1 overflow-y-auto pr-1">
          {puzzles.map(({ n, filename }) => {
            const isSelected = selectedN === n;
            return (
              <li
                key={n}
                onClick={() => setSelectedN(isSelected ? null : n)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs transition-colors ${
                  isSelected
                    ? "border border-sky-400/40 bg-sky-500/15 text-white"
                    : "border border-transparent bg-black/20 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="truncate">{filename}</span>
                {isSelected ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleLoad(n); }}
                    className="shrink-0 rounded-md border border-sky-400/50 bg-sky-500/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-200 transition hover:bg-sky-500/40"
                  >
                    Load
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
