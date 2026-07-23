export type PuzzleStatus = "hidden" | "test" | "deployed";
export type PuzzleAccessLevel = "admin" | "preview" | "public";

const ALL_STATUSES: PuzzleStatus[] = ["hidden", "test", "deployed"];

/** Resolve a puzzle's status, honoring the new `status` field and falling back to legacy `deploy`. */
export function puzzleStatusOf(doc: { status?: string | null; deploy?: boolean | null }): PuzzleStatus {
  if (doc.status && (ALL_STATUSES as string[]).includes(doc.status)) {
    return doc.status as PuzzleStatus;
  }
  return doc.deploy ? "deployed" : "hidden";
}

/** Statuses a given access level is allowed to see, most-restricted last. */
export function visibleStatusesFor(level: PuzzleAccessLevel): PuzzleStatus[] {
  switch (level) {
    case "admin":
      return ["hidden", "test", "deployed"];
    case "preview":
      return ["test", "deployed"];
    case "public":
      return ["deployed"];
  }
}

export function isPuzzleVisibleTo(status: PuzzleStatus, level: PuzzleAccessLevel): boolean {
  return visibleStatusesFor(level).includes(status);
}

/** Narrow untrusted input (request body) to a valid status, or null. */
export function parsePuzzleStatus(value: unknown): PuzzleStatus | null {
  return typeof value === "string" && (ALL_STATUSES as string[]).includes(value)
    ? (value as PuzzleStatus)
    : null;
}
