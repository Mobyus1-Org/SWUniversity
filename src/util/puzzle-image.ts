// Puzzle select-menu thumbnails.
//
// Each puzzle stores an `assetPath` relative to `public/assets/` (e.g.
// "puzzles/mandalore.png"). Puzzles without one fall back to the SWUniversity
// card back. In the puzzle editor an admin types just a filename, which is filed
// under `public/assets/puzzles/`.

/** Default image (relative to public/assets/) for puzzles with no assetPath set. */
export const DEFAULT_PUZZLE_IMAGE = "SWUniversity_Cardback.png";

/**
 * Normalize a user-entered puzzle image path (relative to public/assets/).
 * - blank (or the default card back) -> "" (so the default applies)
 * - a bare filename -> "puzzles/<filename>"
 * - an explicit path (contains "/") -> used as-is, with any leading slash stripped
 *
 * The default card back lives at public/assets/, not under puzzles/, so treating
 * it as blank keeps the edit -> save round-trip from mis-filing it under puzzles/.
 */
export function normalizePuzzleAssetPath(input: string): string {
  const trimmed = input.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed === DEFAULT_PUZZLE_IMAGE) return "";
  if (trimmed.includes("/")) return trimmed;
  return `puzzles/${trimmed}`;
}

/** Resolve the <img src> for a puzzle's stored assetPath, falling back to the default. */
export function puzzleImageSrc(assetPath?: string): string {
  const path = (assetPath ?? "").trim() || DEFAULT_PUZZLE_IMAGE;
  return `/assets/${path}`;
}
