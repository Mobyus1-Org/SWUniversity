import React from "react";
import { CardTitle, CardSubtitle } from "@/server/engine/card-db/generated";

type PreviewHandlers = {
  onPreviewStart: (p: { imageId: string; cardId: string; label?: string }) => void;
  onPreviewEnd: () => void;
};

// Parses "@[SET_XYZ]" or "@[SET_XYZ-L]", returning the base cardId and whether
// the leader unit side (back face) was requested via the "-L" suffix.
function extractCardId(raw: string): { cardId: string; showLeaderUnit: boolean } {
  const inner = (/^@\[(.+)\]$/.exec(raw.trim())?.[1] ?? raw.trim());
  if (inner.endsWith("-L")) {
    return { cardId: inner.slice(0, -2), showLeaderUnit: true };
  }
  return { cardId: inner, showLeaderUnit: false };
}

export function CardLink({ raw, ...handlers }: { raw: string } & PreviewHandlers) {
  const { cardId, showLeaderUnit } = extractCardId(raw);
  const title = CardTitle(cardId);
  const subtitle = CardSubtitle(cardId);
  const label = subtitle ? `${title} — ${subtitle}` : title;
  const imageId = showLeaderUnit ? `${cardId}_BACK` : cardId;

  return (
    <span
      className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-sky-300 transition-colors"
      onMouseEnter={() => handlers.onPreviewStart({ imageId, cardId, label })}
      onMouseLeave={handlers.onPreviewEnd}
    >
      {label}
    </span>
  );
}

// Splits a string on @[SET_XYZ] tokens and returns an array of string | cardId pairs.
type Segment = { type: "text"; value: string } | { type: "card"; raw: string };

function parseSegments(text: string): Segment[] {
  const parts = text.split(/(@\[[^\]]+\])/g);
  return parts.map((part) =>
    /^@\[.+\]$/.test(part)
      ? { type: "card", raw: part }
      : { type: "text", value: part },
  );
}

export function CardLinkText({ text, ...handlers }: { text: string } & PreviewHandlers) {
  const segments = parseSegments(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "card"
          ? <CardLink key={i} raw={seg.raw} {...handlers} />
          : <React.Fragment key={i}>{seg.value}</React.Fragment>,
      )}
    </>
  );
}
