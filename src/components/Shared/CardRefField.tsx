import React from "react";

import { CardSubtitle, CardTitle, GetAllCardIds } from "@/server/engine/card-db/generated";
import { findOpenRef, isKnownCardId, parseCardRefs } from "@/util/card-ref";

type Suggestion = { cardId: string; label: string };

// Built once: every id the renderer can actually resolve, so anything the
// dropdown offers is valid by construction.
const SUGGESTIONS: Suggestion[] = GetAllCardIds()
  .map((cardId) => {
    const title = CardTitle(cardId);
    const subtitle = CardSubtitle(cardId);
    return { cardId, label: subtitle ? `${title} — ${subtitle}` : title };
  })
  .filter((s) => s.label.trim().length > 0)
  .sort((a, b) => a.label.localeCompare(b.label));

const MAX_ROWS = 20;

function search(query: string): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return SUGGESTIONS.slice(0, MAX_ROWS);
  const hits = SUGGESTIONS.filter(
    (s) => s.label.toLowerCase().includes(q) || s.cardId.toLowerCase().includes(q),
  );
  // Prefix matches first — typing "battle" should surface "Battle Droid" above
  // "Super Battle Droid".
  hits.sort((a, b) => {
    const ap = a.label.toLowerCase().startsWith(q) ? 0 : 1;
    const bp = b.label.toLowerCase().startsWith(q) ? 0 : 1;
    return ap - bp;
  });
  return hits.slice(0, MAX_ROWS);
}

type CardRefFieldProps = {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  rows?: number;
  className?: string;
};

export function CardRefField({ value, onChange, multiline = false, rows = 2, className = "" }: CardRefFieldProps) {
  const fieldRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [caret, setCaret] = React.useState(0);
  const [dismissed, setDismissed] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  const openRef = React.useMemo(() => findOpenRef(value, caret), [value, caret]);
  const matches = React.useMemo(() => (openRef ? search(openRef.query) : []), [openRef]);
  const showDropdown = !dismissed && openRef !== null && matches.length > 0;

  const refs = React.useMemo(() => parseCardRefs(value), [value]);

  React.useEffect(() => { setHighlight(0); }, [openRef?.query]);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setDismissed(true);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function syncCaret(el: HTMLInputElement | HTMLTextAreaElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setDismissed(false);
    syncCaret(e.target);
    onChange(e.target.value);
  }

  function accept(s: Suggestion) {
    if (!openRef) return;
    const insert = `@[${s.cardId}]`;
    const next = value.slice(0, openRef.start) + insert + value.slice(caret);
    const nextCaret = openRef.start + insert.length;
    onChange(next);
    setDismissed(true);
    // Restore focus and drop the caret just past the inserted "]".
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      accept(matches[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissed(true);
    }
  }

  const fieldClass = `w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none ${multiline ? "resize-y" : ""} ${className}`;

  const shared = {
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => syncCaret(e.currentTarget),
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => syncCaret(e.currentTarget),
    className: fieldClass,
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {multiline
        ? <textarea ref={(el) => { fieldRef.current = el; }} rows={rows} {...shared} />
        : <input ref={(el) => { fieldRef.current = el; }} type="text" {...shared} />}

      {showDropdown && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-white/20 bg-[rgba(10,15,35,0.98)] shadow-xl backdrop-blur-sm">
          {matches.map((s, i) => (
            <li key={s.cardId}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); accept(s); }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs ${i === highlight ? "bg-white/15 text-white" : "text-white/80"}`}
              >
                <span>{s.label}</span>
                <span className="shrink-0 font-mono text-[10px] text-white/40">{s.cardId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {refs.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {refs.map((r, i) => (
            isKnownCardId(r.cardId)
              ? <div key={i} className="text-[10px] text-emerald-300/80">✓ {r.cardId} → {CardTitle(r.cardId)}{r.showLeaderUnit ? " (leader unit side)" : ""}</div>
              : <div key={i} className="text-[10px] text-rose-300">✗ {r.cardId} → unknown card ID</div>
          ))}
        </div>
      )}
    </div>
  );
}
