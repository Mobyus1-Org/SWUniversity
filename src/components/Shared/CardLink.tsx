import React from "react";
import { CardTitle, CardSubtitle } from "@/server/engine/card-db/generated";

type PreviewHandlers = {
  onPreviewStart: (p: { imageId: string; cardId: string; label?: string }) => void;
  onPreviewEnd: () => void;
};

// Strips "@[SET_XYZ]" wrapper if present, returning the raw card ID.
function extractCardId(raw: string): string {
  const match = /^@\[(.+)\]$/.exec(raw.trim());
  return match ? match[1] : raw.trim();
}

export function CardLink({ raw, ...handlers }: { raw: string } & PreviewHandlers) {
  const cardId = extractCardId(raw);
  const title = CardTitle(cardId);
  const subtitle = CardSubtitle(cardId);
  const label = subtitle ? `${title} — ${subtitle}` : title;

  return (
    <span
      className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-sky-300 transition-colors"
      onMouseEnter={() => handlers.onPreviewStart({ imageId: cardId, cardId, label })}
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
