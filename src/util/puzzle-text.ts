import { type CardRef, parseCardRefs } from "@/util/card-ref";

/**
 * One piece of puzzle text: either a `@[CARD_ID]` reference or the raw text between references.
 */
export type RichTextSegment =
  | { kind: "card"; ref: CardRef }
  | { kind: "text"; value: string };

/**
 * Splits puzzle text into card references and the text around them.
 *
 * Puzzle text carries TWO markups — `@[CARD_ID]` references and the Quiz-style `**bold**` /
 * `_italic_` inline markup — and the order they are parsed in is not a preference, it is a
 * correctness requirement: card ids contain underscores, so running the italic parser first turns
 * `@[SOR_001]` into `@[SOR` + an italic run. Refs come out here first, and only the `text`
 * segments are ever handed to the inline formatter.
 *
 * Empty text between (or around) references is dropped, so a caller can map straight over the
 * result without filtering blanks.
 */
export function segmentByCardRefs(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let cursor = 0;

  for (const ref of parseCardRefs(text)) {
    if (ref.start > cursor) segments.push({ kind: "text", value: text.slice(cursor, ref.start) });
    segments.push({ kind: "card", ref });
    cursor = ref.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });

  return segments;
}
