import React from "react";

import {
  CardPreviewOverlay, PreviewImage, previewFaces, useCardPreview, useLongPress,
} from "@/components/Shared/CardPreview";
import {
  CARD_IMPL_LANES, deriveLanes, isLegalTransition,
  type CardImplLane, type CardImplRow,
} from "@/server/cards-impl/status-board";
import { CardIsLeader } from "@/server/engine/core-functions";

type BoardCard = {
  cardId: string;
  title: string;
  subtitle: string;
  set: string;
  type: string;
};

const LANE_LABEL: Record<CardImplLane, string> = {
  todo: "To Do",
  priority: "Priority",
  "needs-work": "Needs Work",
  done: "Done",
};

/** Buttons offered on each lane, straight off the spec's control table. */
const LANE_ACTIONS: Record<CardImplLane, CardImplLane[]> = {
  todo: ["priority", "needs-work", "done"],
  priority: ["todo", "needs-work", "done"],
  "needs-work": ["done"],
  done: ["needs-work"],
};

const LANE_ACCENT: Record<CardImplLane, string> = {
  todo: "border-white/15",
  priority: "border-amber-400/40",
  "needs-work": "border-rose-400/40",
  done: "border-emerald-400/40",
};

/**
 * How many cards each lane renders. To Do opens at ~2400 and Done trends toward it, so neither can
 * be drawn in full; the search box is how you reach a specific card.
 */
const LANE_RENDER_CAP = 60;

export default function CardsImplPage() {
  const [cards, setCards] = React.useState<BoardCard[]>([]);
  const [statuses, setStatuses] = React.useState<CardImplRow[]>([]);
  const [search, setSearch] = React.useState("");
  const [setFilter, setSetFilter] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const preview = useCardPreview();

  React.useEffect(() => {
    void fetch("/api/admin/card-impl", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCards(Array.isArray(data.cards) ? data.cards : []);
        setStatuses(Array.isArray(data.statuses) ? data.statuses : []);
      })
      .catch(() => setError("Unable to load the card board."))
      .finally(() => setLoading(false));
  }, []);

  const byId = React.useMemo(() => {
    const m = new Map<string, BoardCard>();
    for (const c of cards) m.set(c.cardId, c);
    return m;
  }, [cards]);

  const rowByCard = React.useMemo(() => {
    const m = new Map<string, CardImplRow>();
    for (const r of statuses) m.set(r.cardId, r);
    return m;
  }, [statuses]);

  const setCodes = React.useMemo(
    () => [...new Set(cards.map((c) => c.set))].sort(),
    [cards],
  );

  const lanes = React.useMemo(
    () => deriveLanes(cards.map((c) => c.cardId), statuses),
    [cards, statuses],
  );

  /** Title, subtitle or SET_NNN, case-insensitive. */
  const matches = React.useCallback((cardId: string) => {
    const card = byId.get(cardId);
    if (!card) return false;
    if (setFilter !== "" && card.set !== setFilter) return false;
    const q = search.trim().toLowerCase();
    if (q === "") return true;
    return card.cardId.toLowerCase().includes(q)
      || card.title.toLowerCase().includes(q)
      || card.subtitle.toLowerCase().includes(q);
  }, [byId, search, setFilter]);

  async function move(cardId: string, from: CardImplLane, to: CardImplLane) {
    if (!isLegalTransition(from, to)) return;

    let note: string | undefined;
    if (to === "needs-work") {
      // A reason captured now is what stops this lane rotting into unexplained cards later.
      note = window.prompt(`What needs work on ${byId.get(cardId)?.title ?? cardId}?`) ?? undefined;
    }

    setIsMutating(true);
    setError("");
    try {
      const response = await fetch("/api/admin/card-impl", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId, status: to, ...(note ? { note } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Unable to update that card.");
        return;
      }
      // The response is authoritative — with two people (and agents) writing, replacing the whole
      // set keeps this tab honest rather than drifting on a local guess.
      setStatuses(Array.isArray(payload.statuses) ? payload.statuses : []);
    } catch {
      setError("Unable to update that card.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-[110rem] space-y-6 p-6">
      <h1 className="text-3xl font-semibold">Card Implementation</h1>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, subtitle or SET_NNN…"
          className="w-80 rounded border border-white/20 bg-black/30 px-3 py-2 text-sm"
        />
        <select
          value={setFilter}
          onChange={(e) => setSetFilter(e.target.value)}
          className="rounded border border-white/20 bg-black/30 px-3 py-2 text-sm"
        >
          <option value="">All sets</option>
          {setCodes.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
        <span className="text-sm text-gray-400">{cards.length} cards in scope</span>
      </div>

      {error !== "" ? (
        <p className="rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
      ) : null}
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {CARD_IMPL_LANES.map((lane) => {
          const all = lanes[lane].filter(matches);
          const shown = all.slice(0, LANE_RENDER_CAP);
          return (
            <section key={lane} className={`rounded-lg border bg-black/30 p-4 ${LANE_ACCENT[lane]}`}>
              <h2 className="text-xl font-semibold">{LANE_LABEL[lane]}</h2>
              <p className="mb-3 text-sm text-gray-400">
                {all.length === shown.length
                  ? `${all.length} cards`
                  : `showing ${shown.length} of ${all.length.toLocaleString()}`}
              </p>
              {/* Only the card list scrolls, so the lane heading and its count stay put while you
                  work down a column. pr-1 keeps the scrollbar off the tiles. */}
              <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-1">
                {shown.map((cardId) => (
                  <CardTile
                    key={cardId}
                    card={byId.get(cardId)!}
                    row={rowByCard.get(cardId)}
                    lane={lane}
                    disabled={isMutating}
                    onMove={move}
                    onPreviewStart={preview.onPreviewStart}
                    onPreviewEnd={preview.onPreviewEnd}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <CardPreviewOverlay {...preview} />
    </div>
  );
}

function CardTile({
  card, row, lane, disabled, onMove, onPreviewStart, onPreviewEnd,
}: {
  card: BoardCard;
  row?: CardImplRow;
  lane: CardImplLane;
  disabled: boolean;
  onMove: (cardId: string, from: CardImplLane, to: CardImplLane) => void;
  onPreviewStart: ReturnType<typeof useCardPreview>["onPreviewStart"];
  onPreviewEnd: () => void;
}) {
  const label = card.subtitle ? `${card.title} — ${card.subtitle}` : card.title;
  const previewState = { imageId: card.cardId, cardId: card.cardId, label };
  const hold = useLongPress(() => onPreviewStart(previewState, { sticky: true }));

  // A leader shows BOTH faces: the landscape front and the portrait deployed unit side.
  const faces = CardIsLeader(card.cardId)
    ? previewFaces(card.cardId)
    : [{ imageId: card.cardId, landscape: false }];

  return (
    <div className="rounded border border-white/10 bg-black/20 p-2">
      <div
        className="flex items-start gap-2"
        onMouseEnter={() => onPreviewStart(previewState)}
        onMouseLeave={onPreviewEnd}
        {...hold.props}
      >
        {faces.map((face) => (
          <PreviewImage
            key={face.imageId}
            imageId={face.imageId}
            alt={label}
            className={`rounded ${face.landscape ? "h-10 w-auto" : "w-10 h-auto"}`}
          />
        ))}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{card.title}</div>
          {card.subtitle ? <div className="truncate text-xs text-gray-400">{card.subtitle}</div> : null}
          <div className="font-mono text-[0.7rem] text-gray-500">{card.cardId}</div>
        </div>
      </div>

      {row?.note ? (
        <p className="mt-1 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{row.note}</p>
      ) : null}
      {row?.updatedBy ? (
        <p className="mt-1 text-[0.7rem] text-gray-500">
          {row.updatedBy} · {new Date(row.updatedAt).toLocaleDateString()}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1">
        {LANE_ACTIONS[lane].map((target) => (
          <button
            key={target}
            type="button"
            disabled={disabled}
            onClick={() => onMove(card.cardId, lane, target)}
            className="rounded border border-white/20 bg-white/5 px-2 py-1 text-xs transition hover:bg-white/15 disabled:opacity-40"
          >
            {LANE_LABEL[target]}
          </button>
        ))}
      </div>
    </div>
  );
}
