export type CardImplLane = "not-implemented" | "todo" | "priority" | "done";

export type CardImplRow = {
  cardId: string;
  status: CardImplLane;
  note?: string;
  priorityRank?: number;
  /** When the card last ENTERED Done (ISO). Absent on rows finished before it was tracked. */
  doneAt?: string;
  updatedBy: string;
  updatedAt: string;
};

export const CARD_IMPL_LANES: CardImplLane[] = ["not-implemented", "todo", "priority", "done"];

/** How far back the Done lane's "Recents Only" view reaches: 6 weeks. */
export const RECENT_DONE_DAYS = 42;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The doneAt a row should hold after moving to `to`.
 *
 * Only ENTERING Done stamps it. A Done card re-posted as Done keeps what it had, so re-saving a
 * note can't make an old card look recent — and a legacy unstamped row stays unstamped. Leaving
 * Done clears it, so a card sent back to Priority and finished again is recent again.
 */
export function nextDoneAt(
  previous: { status: string; doneAt?: Date } | null,
  to: CardImplLane,
  now: Date,
): Date | undefined {
  if (to !== "done") return undefined;
  if (previous?.status === "done") return previous.doneAt;
  return now;
}

/** True when the row entered Done within the last RECENT_DONE_DAYS. Rows with no doneAt never are. */
export function isRecentlyDone(row: CardImplRow | undefined, now: Date): boolean {
  if (!row?.doneAt) return false;
  return now.getTime() - new Date(row.doneAt).getTime() <= RECENT_DONE_DAYS * DAY_MS;
}

/**
 * Which lanes a card can move to from each lane.
 *
 * Every move is legal. The old table existed to protect the Needs Work lane, which is gone: a card
 * found to be buggy now goes back to Priority, so Done must be able to route there. Change it HERE
 * and the UI and the agent CLI both follow.
 */
const ALLOWED_MOVES: Record<CardImplLane, CardImplLane[]> = {
  "not-implemented": ["todo", "priority", "done"],
  todo: ["not-implemented", "priority", "done"],
  priority: ["not-implemented", "todo", "done"],
  done: ["not-implemented", "todo", "priority"],
};

export function isLegalTransition(from: CardImplLane, to: CardImplLane): boolean {
  if (from === to) return true;
  return ALLOWED_MOVES[from].includes(to);
}

/** Highest Priority rank currently in use, plus one. Rows that have left Priority don't count. */
export function nextPriorityRank(rows: CardImplRow[]): number {
  const ranks = rows
    .filter(r => r.status === "priority" && typeof r.priorityRank === "number")
    .map(r => r.priorityRank as number);
  return ranks.length === 0 ? 1 : Math.max(...ranks) + 1;
}

/**
 * Splits the card universe into lanes. A card with no row is NOT IMPLEMENTED — that is the derived
 * lane, which is how ~2400 untouched cards cost nothing to store. To Do is an explicit lane: a
 * card only lands there once someone deliberately triages it.
 */
export function deriveLanes(inScopeIds: string[], rows: CardImplRow[]): Record<CardImplLane, string[]> {
  const inScope = new Set(inScopeIds);
  const byCard = new Map<string, CardImplRow>();
  for (const r of rows) {
    if (inScope.has(r.cardId)) byCard.set(r.cardId, r);
  }

  const lanes: Record<CardImplLane, string[]> = {
    "not-implemented": [], todo: [], priority: [], done: [],
  };

  for (const cardId of inScopeIds) {
    const status = byCard.get(cardId)?.status ?? "not-implemented";
    // A row left over from an older lane (needs-work) reads as not-implemented rather than
    // throwing, so a stale document can never blank the board.
    (lanes[status] ?? lanes["not-implemented"]).push(cardId);
  }

  // Priority is a ranked lane. A rankless row sorts last but keeps its relative order.
  lanes.priority.sort((a, b) => {
    const ra = byCard.get(a)?.priorityRank ?? Number.MAX_SAFE_INTEGER;
    const rb = byCard.get(b)?.priorityRank ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });

  return lanes;
}
