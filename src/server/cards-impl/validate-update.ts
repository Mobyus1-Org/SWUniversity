import { CARD_IMPL_LANES, type CardImplLane } from "@/server/cards-impl/status-board";

export type ValidatedUpdate = {
  cardId: string;
  status: CardImplLane;
  note?: string;
  priorityRank?: number;
};

export type ValidationResult =
  | { ok: true; value: ValidatedUpdate }
  | { ok: false; error: string };

/**
 * Validates a status update from either the board UI or the agent CLI. Both go through this one
 * function so the two clients can never disagree about what a legal update is.
 */
export function validateStatusUpdate(
  body: unknown,
  isInScope: (cardId: string) => boolean,
): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be an object" };
  }
  const { cardId, status, note, priorityRank } = body as Record<string, unknown>;

  if (typeof cardId !== "string" || cardId.length === 0) {
    return { ok: false, error: "Missing cardId" };
  }
  if (!isInScope(cardId)) {
    return { ok: false, error: `Unknown cardId: ${cardId}` };
  }
  if (typeof status !== "string" || !CARD_IMPL_LANES.includes(status as CardImplLane)) {
    return { ok: false, error: `Unknown status: ${String(status)}` };
  }
  if (priorityRank !== undefined && typeof priorityRank !== "number") {
    return { ok: false, error: "priorityRank must be a number" };
  }

  const value: ValidatedUpdate = { cardId, status: status as CardImplLane };
  // A non-string note is dropped rather than rejected: it is decorative, and failing the whole
  // update over it would block a legitimate lane change.
  if (typeof note === "string" && note.trim().length > 0) value.note = note;
  if (typeof priorityRank === "number") value.priorityRank = priorityRank;

  return { ok: true, value };
}
