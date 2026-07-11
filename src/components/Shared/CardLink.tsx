import React from "react";

import { CardSubtitle, CardTitle } from "@/server/engine/card-db/generated";
import { type CardRef, isKnownCardId, parseCardRefs } from "@/util/card-ref";

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

export function CardLinkText({ text, ...handlers }: { text: string } & PreviewHandlers) {
  const refs = parseCardRefs(text);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  refs.forEach((ref, i) => {
    if (ref.start > cursor) {
      nodes.push(<React.Fragment key={`t${i}`}>{text.slice(cursor, ref.start)}</React.Fragment>);
    }
    nodes.push(<CardLink key={`c${i}`} cardRef={ref} {...handlers} />);
    cursor = ref.end;
  });
  if (cursor < text.length) {
    nodes.push(<React.Fragment key="t-last">{text.slice(cursor)}</React.Fragment>);
  }

  return <>{nodes}</>;
}
