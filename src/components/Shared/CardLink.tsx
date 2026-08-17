import React from "react";

import { CardSubtitle, CardTitle } from "@/server/engine/card-db/generated";
import { type CardRef, isKnownCardId } from "@/util/card-ref";
import { segmentByCardRefs } from "@/util/puzzle-text";
import { renderInlineMarkup } from "@/util/func";

type PreviewHandlers = {
  onPreviewStart: (p: { imageId: string; cardId: string; label?: string }) => void;
  onPreviewEnd: () => void;
};

export function CardLink({ cardRef, ...handlers }: { cardRef: CardRef } & PreviewHandlers) {
  const { cardId, showLeaderUnit } = cardRef;

  // An id the card db doesn't know renders as visible raw text rather than
  // disappearing — a bad reference should never be silent.
  if (!isKnownCardId(cardId)) {
    return (
      <span className="text-rose-300 underline decoration-wavy underline-offset-2" title="Unknown card ID">
        {cardRef.raw}
      </span>
    );
  }

  const title = CardTitle(cardId);
  const subtitle = CardSubtitle(cardId);
  const label = subtitle ? `${title} — ${subtitle}` : title;
  const imageId = showLeaderUnit ? `${cardId}_BACK` : cardId;

  return (
    <span
      className="cursor-pointer underline decoration-dotted underline-offset-2 transition-colors hover:text-sky-300"
      onMouseEnter={() => handlers.onPreviewStart({ imageId, cardId, label })}
      onMouseLeave={handlers.onPreviewEnd}
    >
      {label}
    </span>
  );
}

/**
 * Card references only, with the surrounding text left exactly as written. For engine-generated
 * strings (the game log), which are not authored markup — running a `**`/`_` parser over them would
 * be reinterpreting output nobody wrote as markup.
 */
export function CardLinkText({ text, ...handlers }: { text: string } & PreviewHandlers) {
  return (
    <>
      {segmentByCardRefs(text).map((segment, i) =>
        segment.kind === "card"
          ? <CardLink key={`c${i}`} cardRef={segment.ref} {...handlers} />
          : <React.Fragment key={`t${i}`}>{segment.value}</React.Fragment>,
      )}
    </>
  );
}

/**
 * Puzzle-authored text, with both of its markups rendered: `@[CARD_ID]` references become hoverable
 * card links, and the text around them gets the same `**bold**` / `_italic_` / keyword-colouring
 * treatment Quiz and DYKSWU use.
 *
 * Newlines are left alone — every caller renders this inside a `whitespace-pre-wrap` container, so
 * the formatter is fed one segment at a time rather than the line-splitting variant.
 */
export function PuzzleText({ text, ...handlers }: { text: string } & PreviewHandlers) {
  return (
    <>
      {segmentByCardRefs(text).map((segment, i) =>
        segment.kind === "card"
          ? <CardLink key={`c${i}`} cardRef={segment.ref} {...handlers} />
          : <React.Fragment key={`t${i}`}>{renderInlineMarkup(segment.value, i)}</React.Fragment>,
      )}
    </>
  );
}
