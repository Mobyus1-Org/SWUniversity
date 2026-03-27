import React from "react";
import { CardSubtitle, CardTitle, CardType } from "@/server/engine/card-db/generated";
import { getCardImageLink, getSWUDBImageLink } from "@/util/func";
import { globalBackgroundStyle, lightsaberGlow } from "@/util/style-const";
import { type PuzzleIntent, type PuzzleRuntime } from "@/lib/puzzles/types";
import type { PuzzleUiHints } from "@/server/puzzle/adapters/puzzle-bridge";
import { LoadPuzzlePanel } from "@/components/Shared/LoadPuzzlePanel";
import { PuzzleBuilderPanel } from "@/components/Shared/PuzzleBuilderPanel";

type PreviewState = {
  imageId: string;
  cardId: string;
  label?: string;
};

function getPreviewImageId(cardId: string, showBack = false): string {
  return showBack ? `${cardId}_BACK` : cardId;
}

function formatPrompt(runtime: PuzzleRuntime): string {
  if (runtime.status === "won") {
    return "Puzzle complete.";
  }
  if (runtime.status === "lost") {
    return "Puzzle failed.";
  }
  if (runtime.status === "draw") {
    return "Puzzle ended in a draw.";
  }
  return runtime.prompt?.title ?? "Choose an action by clicking a hand card, your leader, or a ready friendly unit.";
}

function CardVisual({
  cardId,
  imageId,
  selectable,
  onClick,
  onPreviewStart,
  onPreviewEnd,
  exhausted,
  damage,
  footer,
  compact = false,
  arenaScale60 = false,
  sentinel = false,
  square = false,
  handScaleHalf = false,
  centerDamageBadge,
  rotateWhenExhausted = true,
  cardScale90 = false,
  customGlowClass,
}: {
  cardId: string;
  imageId?: string;
  selectable: boolean;
  onClick?: () => void;
  onPreviewStart: (preview: PreviewState) => void;
  onPreviewEnd: () => void;
  exhausted?: boolean;
  damage?: number;
  footer?: React.ReactNode;
  compact?: boolean;
  arenaScale60?: boolean;
  sentinel?: boolean;
  square?: boolean;
  handScaleHalf?: boolean;
  centerDamageBadge?: number;
  rotateWhenExhausted?: boolean;
  cardScale90?: boolean;
  customGlowClass?: string;
}) {
  const pattern = imageId ?? cardId;
  const primarySrc = square ? `/assets/cards/square/${pattern}.webp` : getCardImageLink(pattern);
  const fallbackSrc = square ? getCardImageLink(pattern) : getSWUDBImageLink(pattern);
  const [imageSrc, setImageSrc] = React.useState(primarySrc);
  const title = CardTitle(cardId);
  const subtitle = CardSubtitle(cardId);

  React.useEffect(() => {
    setImageSrc(primarySrc);
  }, [primarySrc]);
  const imageClass = square
    ? "aspect-square"
    : handScaleHalf
      ? "h-28"
    : compact
      ? (arenaScale60 ? (cardScale90 ? "h-[3.24rem]" : "h-[3.6rem]") : (cardScale90 ? "h-[5.4rem]" : "h-24"))
      : (arenaScale60 ? "h-[7.2rem]" : "h-48");

  const cardBody = <>
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/15 bg-black/40 ${selectable ? `cursor-pointer ${customGlowClass ?? lightsaberGlow}` : "opacity-90"}`}
      style={cardScale90 ? { width: "90%", marginInline: "auto" } : undefined}
      onMouseEnter={() => onPreviewStart({ imageId: imageId ?? cardId, cardId, label: subtitle ? `${title} — ${subtitle}` : title })}
      onMouseLeave={onPreviewEnd}
    >
      <div className={`relative transition-transform duration-200 ${exhausted && rotateWhenExhausted ? "rotate-90" : ""}`}>
        <img
          src={imageSrc}
          alt={title}
          className={`w-full object-cover ${imageClass}`}
          onError={() => {
            if (imageSrc !== fallbackSrc) {
              setImageSrc(fallbackSrc);
            }
          }}
        />
        {exhausted ? <div className="pointer-events-none absolute inset-0 bg-black/35" /> : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end p-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
        <span className="flex items-start gap-1">
          {sentinel ? <img src="/assets/tokens/sentinel.png" alt="Sentinel bodyguard" className="h-8 w-8 rounded-sm border border-white/20 bg-black/50" /> : null}
        </span>
      </div>
      {typeof damage === "number" && damage > 0 ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200/30 bg-red-800/55 text-xs font-black text-white shadow-[0_0_12px_rgba(127,29,29,0.4)]">
          {damage}
        </span>
      </div> : null}
      {typeof centerDamageBadge === "number" && centerDamageBadge > 0 ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200/25 bg-rose-800/55 text-sm font-black text-white shadow-[0_0_14px_rgba(127,29,29,0.45)]">
          {centerDamageBadge}
        </span>
      </div> : null}
    </div>
    {footer ? <div className="mt-2">{footer}</div> : null}
  </>;

  if (!selectable || !onClick) {
    return <div>{cardBody}</div>;
  }

  return <button type="button" className="w-full text-left" onClick={onClick}>{cardBody}</button>;
}

function FaceDownResource({
  cardId,
  selectable = false,
  exhausted = false,
  onPreviewStart,
  onPreviewEnd,
}: {
  cardId: string;
  selectable?: boolean;
  exhausted?: boolean;
  onPreviewStart: (preview: PreviewState) => void;
  onPreviewEnd: () => void;
}) {
  return <div
    className={`overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-transform duration-200 ${exhausted ? "rotate-90" : ""} ${selectable ? lightsaberGlow : ""}`}
    onMouseEnter={() => onPreviewStart({ imageId: cardId, cardId, label: CardTitle(cardId) })}
    onMouseLeave={onPreviewEnd}
  >
    <img src="/assets/SWUniversity_Cardback.png" alt="Resource card back" className="h-12 w-12 object-cover object-center" />
  </div>;
}

function ZonePanel({ title, subtitle, children, hideHeader = false }: { title: string; subtitle?: string; children: React.ReactNode; hideHeader?: boolean }) {
  return <section className={`rounded-xl border border-white/10 p-4 ${globalBackgroundStyle}`}>
    {!hideHeader ? <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/80">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-white/60">{subtitle}</p> : null}
      </div>
    </div> : null}
    {children}
  </section>;
}

function SectionShell({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-white/10 p-4 ${globalBackgroundStyle} ${className}`}>
    <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70">{title}</h2>
    {children}
  </section>;
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg bg-black/20 p-3 text-xs text-white/70">
    <div className="uppercase tracking-[0.2em] text-white/50">{label}</div>
    <div className="mt-2 text-2xl font-black text-white">{value}</div>
  </div>;
}

function PuzzlesPage({ showBuilderTools = false }: { showBuilderTools?: boolean }) {
  // All hooks must be called unconditionally at the top
  const [runtime, setRuntime] = React.useState<PuzzleRuntime | null>(null);
  const [ui, setUi] = React.useState<PuzzleUiHints | null>(null);
  const [isResolving, setIsResolving] = React.useState(false);
  const [lastActionMs, setLastActionMs] = React.useState<number | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const [showBuilderPanelOpen, setShowBuilderPanelOpen] = React.useState(false);
  const [showClosePuzzleConfirm, setShowClosePuzzleConfirm] = React.useState(false);
  const [selectedPuzzleN, setSelectedPuzzleN] = React.useState<number | null>(null);
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewPrimarySrc = preview ? getCardImageLink(preview.imageId) : "";
  const previewFallbackSrc = preview ? getSWUDBImageLink(preview.imageId) : "";
  const [previewImageSrc, setPreviewImageSrc] = React.useState(previewPrimarySrc);

  // Clear preview timer
  const clearPreviewTimer = React.useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, [previewTimerRef]);

  // Preview handlers
  const handlePreviewStart = React.useCallback((nextPreview: PreviewState) => {
    clearPreviewTimer();
    setPreview(null);
    previewTimerRef.current = setTimeout(() => {
      setPreview(nextPreview);
    }, 1200);
  }, [clearPreviewTimer, setPreview]);
  const handlePreviewEnd = React.useCallback(() => {
    clearPreviewTimer();
    setPreview(null);
  }, [clearPreviewTimer, setPreview]);
  React.useEffect(() => () => { clearPreviewTimer(); }, [clearPreviewTimer]);

  // Always send intent to server, never mutate local game state
  const dispatch = React.useCallback((intent: PuzzleIntent) => {
    if (isResolving || !runtime) return;
    setIsResolving(true);
    setActionError(null);
    const clientStart = performance.now();
    fetch("/api/engine/resolve-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: runtime, action: intent }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Unable to resolve action." }));
          throw new Error(payload.error ?? "Unable to resolve action.");
        }
        return response.json() as Promise<{ state: PuzzleRuntime; ui: PuzzleUiHints; serverDurationMs: number }>;
      })
      .then((payload) => {
        setRuntime(payload.state);
        setUi(payload.ui);
        const endToEndMs = Math.round(performance.now() - clientStart);
        setLastActionMs(endToEndMs);
      })
      .catch((error) => {
        setActionError(error instanceof Error ? error.message : "Unable to resolve action.");
      })
      .finally(() => setIsResolving(false));
  }, [isResolving, runtime, setIsResolving, setActionError, setRuntime, setLastActionMs, setUi]);

  const loadPuzzle = React.useCallback((n: number) => {
    setIsResolving(true);
    setActionError(null);
    fetch(`/api/internal/test-puzzles?n=${n}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Load failed");
        return r.json() as Promise<{ state: PuzzleRuntime; ui: PuzzleUiHints }>;
      })
      .then(({ state, ui }) => {
        setRuntime(state);
        setUi(ui);
      })
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : "Load failed.");
      })
      .finally(() => setIsResolving(false));
  }, [setIsResolving, setActionError, setRuntime, setUi]);

  // Always call hooks before any return
  React.useEffect(() => {
    setPreviewImageSrc(previewPrimarySrc);
  }, [previewPrimarySrc, setPreviewImageSrc]);

  if (!runtime) {
    return <div className="relative z-10 mx-auto w-full max-w-[1920px] px-3 py-4 text-white sm:px-4 lg:px-6">
      {showBuilderPanelOpen && showBuilderTools ? (
        <PuzzleBuilderPanel
          onClose={() => setShowBuilderPanelOpen(false)}
          onSaved={(n) => {
            setShowBuilderPanelOpen(false);
          }}
        />
      ) : null}
      {showBuilderTools ? (
        <div className="mb-3 flex items-start gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <LoadPuzzlePanel
            onPuzzleLoaded={(n, state, loadedUi) => {
              setSelectedPuzzleN(n);
              setRuntime(state);
              setUi(loadedUi);
            }}
          />
          <button
            type="button"
            onClick={() => setShowBuilderPanelOpen(true)}
            className="shrink-0 self-start rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500/25"
          >
            Build New Puzzle
          </button>
        </div>
      ) : null}
      <p className="mt-4 text-center text-sm text-white/60">Select a puzzle to get started.</p>
    </div>;
  }

  const player = runtime.game.player1;
  const opponent = runtime.game.player2;
  const selectablePlayIds = ui?.selectablePlayIds ?? [];
  const selectableBaseForPlayer = ui?.selectableBaseForPlayer ?? [];
  const uiCanClickLeader = ui?.canClickLeader ?? false;
  const sentinelPlayIds = ui?.sentinelPlayIds ?? [];
  const selectableHandIndices = ui?.selectableHandIndices ?? [];
  const latestEnemyDiscard = opponent.discard.length > 0 ? opponent.discard[opponent.discard.length - 1] : null;
  const latestPlayerDiscard = player.discard.length > 0 ? player.discard[player.discard.length - 1] : null;
  const hasPrompt = Boolean(runtime.prompt);
  const promptOptions = ui?.promptOptions ?? [];
  const statusTone = runtime.status === "won"
    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
    : runtime.status === "lost"
      ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
      : runtime.status === "draw"
        ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
      : "border-white/10 bg-white/5 text-white";

  return <div className="relative z-10 mx-auto w-full max-w-[1920px] px-3 py-4 text-white sm:px-4 lg:px-6">
    {showBuilderPanelOpen && showBuilderTools ? (
      <PuzzleBuilderPanel
        onClose={() => setShowBuilderPanelOpen(false)}
        onSaved={(n) => {
          setShowBuilderPanelOpen(false);
          setActionError(`Puzzle ${n} saved.`);
        }}
      />
    ) : null}
    {showBuilderTools && !runtime ? (
      <div className="mb-3 flex items-start gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <LoadPuzzlePanel
          onPuzzleLoaded={(n, state, loadedUi) => {
            setSelectedPuzzleN(n);
            setRuntime(state);
            setUi(loadedUi);
          }}
        />
        <button
          type="button"
          onClick={() => setShowBuilderPanelOpen(true)}
          className="shrink-0 self-start rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500/25"
        >
          Build New Puzzle
        </button>
      </div>
    ) : null}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-[0.24em] text-white sm:text-3xl">Puzzle Mode</h1>
        <p className="mt-1 text-xs text-white/65 sm:text-sm">Board-first tactical sandbox. Opponent already has initiative.</p>
      </div>
      {showClosePuzzleConfirm ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">Close puzzle?</span>
          <button
            type="button"
            onClick={() => { setRuntime(null); setUi(null); setShowClosePuzzleConfirm(false); setActionError(null); }}
            className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500/35"
          >OK</button>
          <button
            type="button"
            onClick={() => setShowClosePuzzleConfirm(false)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >Cancel</button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Close puzzle"
          onClick={() => setShowClosePuzzleConfirm(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-lg font-bold text-white/60 transition hover:bg-white/20 hover:text-white"
        >✕</button>
      )}
    </div>

    <div className="relative">
      <aside className="hidden xl:block xl:absolute xl:left-0 xl:top-0 xl:w-44">
        <section className={`rounded-lg border border-white/10 p-2 ${globalBackgroundStyle}`}>
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Game Log</h2>
            <span className="text-[10px] text-white/50">{runtime.log.length}</span>
          </div>
          <div className="h-[23vh] space-y-1.5 overflow-y-auto pr-1 text-[10px] leading-4 text-white/80">
            {runtime.log.map((entry, index) => <div key={`${entry}-${index}`} className="rounded-md bg-black/25 px-1.5 py-1">{entry}</div>)}
          </div>
        </section>
        <SectionShell title="Actions" className="mt-2 rounded-lg p-2">
          <div className="mt-2 grid gap-1.5">
            <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={isResolving || runtime.history.length === 0} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
            <button type="button" onClick={() => dispatch({ type: "pass" })} disabled={isResolving || runtime.status !== "playing" || !!runtime.prompt} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Pass</button>
            <button type="button" onClick={() => dispatch({ type: "take-initiative" })} disabled={isResolving || runtime.game.initiativeClaimed || runtime.status !== "playing" || !!runtime.prompt} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Initiative</button>
            <div className="h-3" />
            <button type="button" onClick={() => { if (selectedPuzzleN !== null) loadPuzzle(selectedPuzzleN); }} disabled={isResolving || selectedPuzzleN === null} className="rounded-lg border border-white/15 bg-rose-500/20 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40">Reset</button>
          </div>
          <div className={`mt-1 text-[10px] ${lastActionMs !== null && lastActionMs > 600 ? "text-amber-200" : "text-white/55"}`}>
            {isResolving ? "Resolving..." : lastActionMs !== null ? `Last action ${lastActionMs} ms` : "Last action --"}
          </div>
        </SectionShell>
        <SectionShell title="Initiative" className="mt-2 rounded-lg p-2">
          <div className="mt-2 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] text-white/75">
            {runtime.game.initiativePlayer === 1 ? "Player" : "Enemy"}
          </div>
        </SectionShell>
        <SectionShell title="Status" className="mt-2 rounded-lg p-2">
          <div className={`mt-2 rounded-lg border px-2 py-1.5 text-[10px] ${statusTone}`}>
            <div>{formatPrompt(runtime)}</div>
            {actionError ? <div className="mt-1 text-[10px] text-rose-200">{actionError}</div> : null}
          </div>
        </SectionShell>
      </aside>

      <div className="mx-auto xl:pl-[188px] xl:pr-0 2xl:pl-[200px]">
        <div className="space-y-0">
          <ZonePanel title="Board" hideHeader>
          <div className="space-y-1">
          <div className="space-y-3">
            <div className="grid gap-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Resources ({opponent.resources.length})</div>
                <div className="pointer-events-none absolute bottom-2 right-2 top-2 flex flex-col items-center">
                  <div className="text-center text-[11px] font-semibold text-white/65">{opponent.supplemental.creditTokens ?? 0} Credits</div>
                  <img src="/assets/tokens/credit.webp" alt="Credit token" className="mt-1 h-[80%] w-auto max-h-[80%] object-contain" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {opponent.resources.map((resource) => <FaceDownResource
                    key={resource.playId}
                    cardId={resource.cardId}
                    exhausted={!resource.ready}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                  />)}
                  {opponent.resources.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/40">No resources</div> : null}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Deck</div>
                <StatCard label="Count" value={opponent.deck.length} />
              </div>
              <div className="rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Discard</div>
                {latestEnemyDiscard ? <div className="w-24">
                  <CardVisual
                    cardId={latestEnemyDiscard.cardId}
                    selectable={false}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                  />
                </div> : <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/40">Empty</div>}
                <div className="mt-2 text-xs text-white/70">{opponent.discard.length} total</div>
              </div>
            </div>

            <div className="space-y-2 xl:hidden">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.spaceArena.map((unit) => <div key={unit.playId} className="w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => dispatch({ type: "click-unit", playId: unit.playId }) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      square
                    />
                  </div>)}
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Ground</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.groundArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.groundArena.map((unit) => <div key={unit.playId} className="w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => dispatch({ type: "click-unit", playId: unit.playId }) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      square
                    />
                  </div>)}
                </div>
              </div>

              <div className="rounded-lg bg-black/20 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {!opponent.leader.deployed ? <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={opponent.leader.cardId}
                    selectable={false}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!opponent.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                  /></div> : <div className="mx-auto w-full max-w-[140px] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={opponent.base.cardId}
                    selectable={selectableBaseForPlayer.includes(2)}
                    onClick={selectableBaseForPlayer.includes(2) ? () => dispatch({ type: "click-base", player: 2 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                    centerDamageBadge={opponent.base.damage}
                  /></div>
                </div>
              </div>
            </div>

            <div className="hidden gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_165px_minmax(0,1fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.spaceArena.map((unit) => <div key={unit.playId} className="w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => dispatch({ type: "click-unit", playId: unit.playId }) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      square
                    />
                  </div>)}
                </div>
              </div>

              <div className="rounded-lg bg-black/20 p-2">
                <div className="grid grid-cols-2 gap-2 xl:hidden">
                  {!opponent.leader.deployed ? <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={opponent.leader.cardId}
                    selectable={false}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!opponent.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                  /></div> : <div className="mx-auto w-full max-w-[140px] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={opponent.base.cardId}
                    selectable={selectableBaseForPlayer.includes(2)}
                    onClick={selectableBaseForPlayer.includes(2) ? () => dispatch({ type: "click-base", player: 2 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                    centerDamageBadge={opponent.base.damage}
                  /></div>
                </div>
                <div className="hidden xl:space-y-2 xl:block">
                  {!opponent.leader.deployed ? <CardVisual
                    cardId={opponent.leader.cardId}
                    selectable={false}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!opponent.leader.ready}
                    rotateWhenExhausted={false}
                    cardScale90
                    compact
                  /> : <div className="rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <CardVisual
                    cardId={opponent.base.cardId}
                    selectable={selectableBaseForPlayer.includes(2)}
                    onClick={selectableBaseForPlayer.includes(2) ? () => dispatch({ type: "click-base", player: 2 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    cardScale90
                    centerDamageBadge={opponent.base.damage}
                  />
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Ground</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.groundArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.groundArena.map((unit) => <div key={unit.playId} className="w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => dispatch({ type: "click-unit", playId: unit.playId }) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      square
                    />
                  </div>)}
                </div>
              </div>
            </div>
          </div>

          <div className="-mt-2 space-y-3">
            <div className="space-y-2 xl:hidden">
              <div className="rounded-lg bg-black/20 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {!player.leader.deployed ? <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={player.leader.cardId}
                    selectable={uiCanClickLeader}
                    onClick={uiCanClickLeader ? () => dispatch({ type: "click-leader", player: 1 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!player.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                    footer={<div className="text-center text-xs text-white/80">{player.leader.epicActionUsed ? "Epic used" : "Ready"}</div>}
                  /></div> : <div className="mx-auto w-full max-w-[140px] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={player.base.cardId}
                    selectable={selectableBaseForPlayer.includes(1)}
                    onClick={selectableBaseForPlayer.includes(1) ? () => dispatch({ type: "click-base", player: 1 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                    centerDamageBadge={player.base.damage}
                  /></div>
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Ground</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {player.groundArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {player.groundArena.map((unit) => <div key={unit.playId} className="w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      imageId={getPreviewImageId(unit.cardId, CardType(unit.cardId) === "Leader")}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => dispatch({ type: "click-unit", playId: unit.playId }) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      square
                    />
                  </div>)}
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {player.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {player.spaceArena.map((unit) => {
                    const isLeader = CardType(unit.cardId) === "Leader";
                    return <div key={unit.playId} className="w-24 shrink-0">
                      <CardVisual
                        cardId={unit.cardId}
                        imageId={getPreviewImageId(unit.cardId, isLeader)}
                        selectable={selectablePlayIds.includes(unit.playId)}
                        onClick={selectablePlayIds.includes(unit.playId) ? () => dispatch({ type: "click-unit", playId: unit.playId }) : undefined}
                        onPreviewStart={handlePreviewStart}
                        onPreviewEnd={handlePreviewEnd}
                        exhausted={!unit.ready}
                        damage={unit.damage}
                        compact
                        arenaScale60
                        sentinel={sentinelPlayIds.includes(unit.playId)}
                        square
                      />
                    </div>})
                  }
                </div>
              </div>
            </div>

            <div className="hidden gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_165px_minmax(0,1fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibond uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {player.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {player.spaceArena.map((unit) => <div key={unit.playId} className="w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      imageId={getPreviewImageId(unit.cardId)}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => dispatch({ type: "click-unit", playId: unit.playId }) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      square
                    />
                  </div>)}
                </div>
              </div>

              <div className="rounded-lg bg-black/20 p-2">
                <div className="grid grid-cols-2 gap-2 xl:hidden">
                  {!player.leader.deployed ? <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={player.leader.cardId}
                    selectable={uiCanClickLeader}
                    onClick={uiCanClickLeader ? () => dispatch({ type: "click-leader", player: 1 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!player.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                    footer={<div className="text-center text-xs text-white/80">{player.leader.epicActionUsed ? "Epic used" : "Ready"}</div>}
                  /></div> : <div className="mx-auto w-full max-w-[140px] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={player.base.cardId}
                    selectable={selectableBaseForPlayer.includes(1)}
                    onClick={selectableBaseForPlayer.includes(1) ? () => dispatch({ type: "click-base", player: 1 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                    centerDamageBadge={player.base.damage}
                  /></div>
                </div>
                <div className="hidden xl:space-y-2 xl:block">
                  <CardVisual
                    cardId={player.base.cardId}
                    selectable={selectableBaseForPlayer.includes(1)}
                    onClick={selectableBaseForPlayer.includes(1) ? () => dispatch({ type: "click-base", player: 1 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    cardScale90
                    centerDamageBadge={player.base.damage}
                  />
                  {!player.leader.deployed ? <CardVisual
                    cardId={player.leader.cardId}
                    selectable={uiCanClickLeader}
                    onClick={uiCanClickLeader ? () => dispatch({ type: "click-leader", player: 1 }) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!player.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    cardScale90
                    footer={<div className="text-center text-xs text-white/80">{player.leader.epicActionUsed ? "Epic used" : "Ready"}</div>}
                  /> : <div className="rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Ground</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {player.groundArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {player.groundArena.map((unit) => {
                    const isLeader = CardType(unit.cardId) === "Leader";
                    return <div key={unit.playId} className="w-24 shrink-0">
                      <CardVisual
                        cardId={unit.cardId}
                        imageId={getPreviewImageId(unit.cardId, isLeader)}
                        selectable={selectablePlayIds.includes(unit.playId)}
                        onClick={selectablePlayIds.includes(unit.playId) ? () => dispatch({ type: "click-unit", playId: unit.playId }) : undefined}
                        onPreviewStart={handlePreviewStart}
                        onPreviewEnd={handlePreviewEnd}
                        exhausted={!unit.ready}
                        damage={unit.damage}
                        compact
                        arenaScale60
                        sentinel={sentinelPlayIds.includes(unit.playId)}
                        square
                      />
                    </div>})
                  }
                </div>
              </div>
            </div>

            <div className="grid gap-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Resources ({player.resources.filter((resource) => resource.ready).length} ready / {player.resources.length})</div>
                <div className="pointer-events-none absolute bottom-2 right-2 top-2 flex flex-col items-center">
                  <div className="text-center text-[11px] font-semibold text-white/65">{player.supplemental.creditTokens ?? 0} Credits</div>
                  <img src="/assets/tokens/credit.webp" alt="Credit token" className="mt-1 h-[80%] w-auto max-h-[80%] object-contain" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {player.resources.map((resource) => <div key={resource.playId} className={!resource.ready ? "opacity-40" : ""}><FaceDownResource
                    cardId={resource.cardId}
                    exhausted={!resource.ready}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                  /></div>)}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Deck</div>
                <StatCard label="Count" value={player.deck.length} />
              </div>
              <div className="rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Discard</div>
                {latestPlayerDiscard ? <div className="w-24">
                  <CardVisual
                    cardId={latestPlayerDiscard.cardId}
                    selectable={false}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                  />
                </div> : <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/40">Empty</div>}
                <div className="mt-2 text-xs text-white/70">{player.discard.length} total</div>
              </div>
            </div>
          </div>
          </div>
          </ZonePanel>
        </div>

        <div className="mt-3">
          <ZonePanel title="Hand" hideHeader>
          <div className="relative overflow-visible">
            <div className="pointer-events-none absolute right-0 top-0 z-10 -translate-y-1/2 text-right text-xs text-white/65">{player.hand.length} cards in hand</div>
            <div className="relative overflow-visible pb-2">
              <div className="overflow-x-auto overflow-y-visible xl:overflow-visible">
                <div className="mx-auto flex w-max gap-2">
              {player.hand.map((card, index) => {
                const selectable = selectableHandIndices.includes(index);
                return <div key={`${card.cardId}-${index}`} className="relative w-[5rem] shrink-0 origin-bottom transition-transform duration-150 hover:z-30 hover:-translate-y-1 hover:scale-[1.3]">
                  <div className="xl:hidden">
                    <CardVisual
                      cardId={card.cardId}
                      selectable={selectable}
                      onClick={selectable ? () => dispatch({ type: "click-hand", handIndex: index }) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      square
                      customGlowClass="shadow-[0_0_10px_rgba(var(--lightsaber-r),var(--lightsaber-g),var(--lightsaber-b),0.55)]"
                    />
                  </div>
                  <div className="hidden xl:block">
                    <CardVisual
                      cardId={card.cardId}
                      selectable={selectable}
                      onClick={selectable ? () => dispatch({ type: "click-hand", handIndex: index }) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      handScaleHalf
                      customGlowClass="shadow-[0_0_10px_rgba(var(--lightsaber-r),var(--lightsaber-g),var(--lightsaber-b),0.55)]"
                    />
                  </div>
                </div>;
              })}
                </div>
              </div>
            </div>
          </div>
          </ZonePanel>
        </div>
      </div>
    </div>

    {preview ? <div className="pointer-events-none fixed bottom-4 right-4 z-50 hidden w-[27rem] rounded-lg border border-white/15 bg-black/85 p-2 shadow-2xl backdrop-blur-sm lg:block">
      <img
        src={previewImageSrc}
        alt={preview.label ?? preview.cardId}
        className="w-full rounded-xl object-cover"
        onError={() => {
          if (previewImageSrc !== previewFallbackSrc) {
            setPreviewImageSrc(previewFallbackSrc);
          }
        }}
      />
      <div className="mt-2 px-1 text-xs text-white/80">{preview.label ?? CardTitle(preview.cardId)}</div>
    </div> : null}

    {hasPrompt ? <div className="fixed bottom-3 left-1/2 z-40 w-[min(1100px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-lg border border-white/20 bg-[rgba(8,12,26,0.94)] px-4 py-3 shadow-2xl backdrop-blur-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Prompt</div>
      <p className="mt-1 text-sm text-white/90">{ui?.promptTitle ?? formatPrompt(runtime)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {promptOptions.map((option) => <button
          key={option.id}
          type="button"
          disabled={isResolving || option.disabled}
          onClick={() => dispatch({ type: "choose-option", optionId: option.id })}
          className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {option.label}
        </button>)}
      </div>
    </div> : null}

    <div className="mt-4 space-y-3 xl:hidden">
      <SectionShell title="Actions" className="rounded-lg p-3">
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={isResolving || runtime.history.length === 0} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
          <button type="button" onClick={() => dispatch({ type: "pass" })} disabled={isResolving || runtime.status !== "playing" || !!runtime.prompt} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Pass to Regroup Draw</button>
          <button type="button" onClick={() => dispatch({ type: "take-initiative" })} disabled={isResolving || runtime.game.initiativeClaimed || runtime.status !== "playing" || !!runtime.prompt} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Take Initiative</button>
          <div className="hidden sm:block h-3" />
          <button type="button" onClick={() => { if (selectedPuzzleN !== null) loadPuzzle(selectedPuzzleN); }} disabled={isResolving || selectedPuzzleN === null} className="rounded-xl border border-white/15 bg-rose-500/20 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40">Reset Puzzle</button>
        </div>
        <div className={`mt-1 text-xs ${lastActionMs !== null && lastActionMs > 600 ? "text-amber-200" : "text-white/55"}`}>
          {isResolving ? "Resolving..." : lastActionMs !== null ? `Last action ${lastActionMs} ms` : "Last action --"}
        </div>
      </SectionShell>
      <SectionShell title="Initiative" className="rounded-lg p-3">
        <div className="mt-2 rounded-lg bg-black/25 px-3 py-2 text-xs text-white/75">
          {runtime.game.initiativePlayer === 1 ? "Player" : "Enemy"}
        </div>
      </SectionShell>
      <SectionShell title="Status" className="rounded-lg p-3">
        <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${statusTone}`}>
          <div>{formatPrompt(runtime)}</div>
          {actionError ? <div className="mt-1 text-xs text-rose-200">{actionError}</div> : null}
        </div>
      </SectionShell>
    </div>
  </div>;
}

export default PuzzlesPage;
