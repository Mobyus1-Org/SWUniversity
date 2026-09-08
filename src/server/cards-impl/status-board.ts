export type CardImplLane = "todo" | "priority" | "needs-work" | "done";

export type CardImplRow = {
  cardId: string;
  status: CardImplLane;
  note?: string;
  priorityRank?: number;
  updatedBy: string;
  updatedAt: string;
};

export const CARD_IMPL_LANES: CardImplLane[] = ["todo", "priority", "needs-work", "done"];

/**
 * Which lanes a card can move to from each lane, per the spec's control table.
 *
 * Needs Work and Done can only swap with each other — neither routes back to To Do. That is the
 * behaviour as specified; it is also a recorded open question, so change it HERE and the UI and
 * the agent CLI both follow.
 */
const ALLOWED_MOVES: Record<CardImplLane, CardImplLane[]> = {
  todo: ["priority", "needs-work", "done"],
  priority: ["todo", "needs-work", "done"],
  "needs-work": ["done"],
  done: ["needs-work"],
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
 * Splits the card universe into lanes. A card with no row — or an explicit `todo` row — is To Do,
 * so moving a card back to To Do never requires deleting a document.
 */
export function deriveLanes(inScopeIds: string[], rows: CardImplRow[]): Record<CardImplLane, string[]> {
  const inScope = new Set(inScopeIds);
  const byCard = new Map<string, CardImplRow>();
  for (const r of rows) {
    if (inScope.has(r.cardId)) byCard.set(r.cardId, r);
  }

  const lanes: Record<CardImplLane, string[]> = { todo: [], priority: [], "needs-work": [], done: [] };

  for (const cardId of inScopeIds) {
    const status = byCard.get(cardId)?.status ?? "todo";
    lanes[status].push(cardId);
  }

  // Priority is a ranked lane. A rankless row sorts last but keeps its relative order.
  lanes.priority.sort((a, b) => {
    const ra = byCard.get(a)?.priorityRank ?? Number.MAX_SAFE_INTEGER;
    const rb = byCard.get(b)?.priorityRank ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });

  return lanes;
}
