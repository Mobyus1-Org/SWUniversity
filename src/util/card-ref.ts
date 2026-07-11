import { CardTitle } from "@/server/engine/card-db/generated";

/** A closed `@[CARD_ID]` reference found in a block of text. */
export type CardRef = {
  raw: string;
  cardId: string;
  showLeaderUnit: boolean;
  start: number;
  end: number;
};

const REF_PATTERN = /@\[([^\]]*)\]/g;

/** Every closed `@[...]` reference in `text`, in source order. */
export function parseCardRefs(text: string): CardRef[] {
  const refs: CardRef[] = [];
  for (const match of text.matchAll(REF_PATTERN)) {
    const inner = match[1].trim();
    const showLeaderUnit = inner.endsWith("-L");
    refs.push({
      raw: match[0],
      cardId: showLeaderUnit ? inner.slice(0, -2) : inner,
      showLeaderUnit,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return refs;
}

/**
 * The unclosed `@[` the caret currently sits inside, if any — used to drive the
 * editor's card-search dropdown. Returns the offset of the `@` and the partial
 * text typed since it.
 */
export function findOpenRef(text: string, caret: number): { start: number; query: string } | null {
  // Sitting inside a reference that already has its "]" is not an open reference,
  // even though nothing closes it before the caret.
  if (parseCardRefs(text).some((ref) => caret > ref.start && caret < ref.end)) return null;

  const before = text.slice(0, caret);
  const start = before.lastIndexOf("@[");
  if (start === -1) return null;
  // A "]" between the "@[" and the caret means that reference is already closed.
  if (before.indexOf("]", start) !== -1) return null;
  return { start, query: before.slice(start + 2) };
}

/** True when the renderer will resolve this id to a real card. */
export function isKnownCardId(cardId: string): boolean {
  return CardTitle(cardId) !== "";
}
