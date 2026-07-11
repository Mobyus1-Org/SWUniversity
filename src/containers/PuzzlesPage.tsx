import React from "react";
import { CardSubtitle, CardTitle } from "@/server/engine/card-db/generated";
import { getCardImageLink, getSWUDBImageLink } from "@/util/func";
import { globalBackgroundStyle, lightsaberGlow } from "@/util/style-const";
import { LoadPuzzlePanel } from "@/components/Shared/LoadPuzzlePanel";
import { PuzzleBuilderPanel } from "@/components/Shared/PuzzleBuilderPanel";
import { CardLinkText } from "@/components/Shared/CardLink";
import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import type { DispatchResponse, DispatchType, DispatchData, GameDispatch, ResolutionRequest } from "@/lib/engine/message-types";
import type { EngineContext } from "@/server/engine/pending-resolution";
import { CardIsLeader } from "@/server/engine/core-functions";
import { CardIsPlayable, ResourceIsSmuggleable } from "@/server/engine/card-playability";

type PreviewState = {
  imageId: string;
  cardId: string;
  label?: string;
};

function getPreviewImageId(cardId: string, showBack = false): string {
  return showBack ? `${cardId}_BACK` : cardId;
}

// ---------------------------------------------------------------------------
// Config — flip to true to use round-trip context mode (HttpTransport pattern)
// ---------------------------------------------------------------------------
const USE_HTTP_TRANSPORT = true;

const PLAYER: PlayerId = 1;

/**
 * A Hand target is only ours to answer when it indexes OUR hand. Effects such as K-2SO's When
 * Defeated make the opponent discard; those indices address their hand, so our cards must stay
 * unclickable (an older engine omitted handOwner entirely — treat that as our own hand).
 */
function isOwnHandTarget(resolution: { handOwner?: PlayerId }): boolean {
  return (resolution.handOwner ?? PLAYER) === PLAYER;
}

const LS_TEST_RAW = "puzzle_builder_test_raw";
const LS_TEST_META = "puzzle_builder_test_meta";

type GameStatus = "playing" | "won" | "lost" | "draw";

function createDispatch(type: DispatchType, data: DispatchData): GameDispatch {
  return {
    dispatchId: globalThis.crypto.randomUUID(),
    dispatchType: type,
    dispatchData: data,
    fromPlayer: PLAYER,
  };
}

function deriveStatus(gameState: GameState): GameStatus {
  if (gameState.defeatedPlayers.includes(1) && gameState.defeatedPlayers.includes(2)) return "draw";
  if (gameState.defeatedPlayers.includes(2)) return "won";
  if (gameState.defeatedPlayers.includes(1)) return "lost";
  return "playing";
}

function formatStatus(status: GameStatus, resolutionNeeded: ResolutionRequest | null): string {
  if (status === "won") return "Puzzle complete!";
  if (status === "lost") return "Puzzle failed.";
  if (status === "draw") return "Puzzle ended in a draw.";
  if (resolutionNeeded?.type === "SpreadDamage") {
    return `Distribute ${resolutionNeeded.totalDamage} damage${resolutionNeeded.optional ? " (optional)" : ""}.`;
  }
  if (resolutionNeeded?.type === "Option") return resolutionNeeded.helperText;
  if (resolutionNeeded?.type === "Target") {
    if ((resolutionNeeded.needsMultiple ?? false) || (resolutionNeeded.maxTargets ?? 1) > 1)
      return `Choose up to ${resolutionNeeded.maxTargets ?? "?"} targets, then confirm.`;
    return "Choose a target.";
  }
  if (resolutionNeeded?.type === "Trigger") return "Choose a trigger.";
  if (resolutionNeeded?.type === "Player") return "Choose a player.";
  if (resolutionNeeded?.type === "DeckSearch") return resolutionNeeded.helperText;
  if (resolutionNeeded?.type === "PeekHand") return resolutionNeeded.mustDiscard ? "Choose a card to discard from the opponent's hand." : "Look at the opponent's hand.";
  return "Choose an action — click a hand card, your leader, or a ready friendly unit.";
}

function formatOptionLabel(option: string): string {
  if (option === "Yes" || option === "No") return option;
  const eqIdx = option.indexOf("=");
  const key = eqIdx >= 0 ? option.slice(0, eqIdx) : option;
  return key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Leaders whose leader-side ability is an ACTION (not passive). Mirrors ActionAbilities() in action-ability.ts.
const LEADERS_WITH_ACTION_ABILITY = new Set([
  //Spark of Rebellion
  "SOR_002", "SOR_003", "SOR_004", "SOR_005", "SOR_006",
  "SOR_007", "SOR_009", "SOR_010", "SOR_011", "SOR_012",
  "SOR_013", "SOR_014", "SOR_016", "SOR_017", "SOR_018",
  //Shadows of the Galaxy
  "SHD_002", "SHD_003", "SHD_004", "SHD_006", "SHD_007",
  "SHD_009", "SHD_010", "SHD_011", "SHD_012", "SHD_013",
  "SHD_016", "SHD_017",
  //Twilight of the Republic
  "TWI_005", "TWI_012",
  //Legends of the Underworld
  "LAW_008",
  //Legacy of the Force
  "LOF_003", "LOF_007",
]);

// Non-leader units with an Action ability. Maps cardId → short label for the modal button.
// Mirrors the playId block of ActionAbilities() in action-ability.ts.
const UNITS_WITH_ACTION_ABILITY: Record<string, string> = {
  "SHD_028": "Draw a card",
};

const BASES_WITH_EPIC_ACTION = new Set([
  "SOR_022", "SOR_025", "SOR_028",
]);

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
  epicUsed = false,
  forceToken = false,
  buff,
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
  epicUsed?: boolean;
  forceToken?: boolean;
  buff?: { power: number; hp: number };
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
    <div className="relative">
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
          {typeof damage === "number" && damage > 0 ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200/30 bg-red-800/75 text-xs font-black text-white shadow-[0_0_12px_rgba(127,29,29,0.4)]">
            {damage}
          </span>
        </div> : null}
        {typeof centerDamageBadge === "number" && centerDamageBadge > 0 ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200/25 bg-rose-800/75 text-sm font-black text-white shadow-[0_0_14px_rgba(127,29,29,0.45)]">
            {centerDamageBadge}
          </span>
        </div> : null}
        {buff ? <div className="pointer-events-none absolute top-4 inset-x-0 flex items-center justify-center">
          <span className="inline-flex w-[95%] items-center justify-center gap-2.5 rounded border border-sky-300/30 bg-sky-500/60 py-0.5 text-[0.6rem] font-black leading-none text-white shadow-[0_0_8px_rgba(14,165,233,0.4)]">
            <span>+{buff.power}</span>
            <span>/</span>
            <span>+{buff.hp}</span>
          </span>
        </div> : null}
      </div>
      {sentinel ? <div className="pointer-events-none absolute top-0 right-0 z-10">
        <img src="/assets/tokens/sentinel.png" alt="Sentinel" className="h-[29px] w-[29px]" />
      </div> : null}
      {epicUsed ? <div className="pointer-events-none absolute -bottom-1 right-1.5 z-10">
        <img src="/assets/tokens/epic-used.png" alt="Epic action used" className="h-[22px] w-[22px] rotate-90" />
      </div> : null}
      {forceToken ? <div className="pointer-events-none absolute -top-1 right-1.5 z-10">
        <img src="/assets/force-token.webp" alt="The Force" title="Has the Force" className="h-[24px] w-[24px] drop-shadow-[0_0_4px_rgba(124,58,237,0.85)]" />
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
  onClick,
}: {
  cardId: string;
  selectable?: boolean;
  exhausted?: boolean;
  onPreviewStart?: (preview: PreviewState) => void;
  onPreviewEnd?: () => void;
  onClick?: () => void;
}) {
  return <div
    className={`overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-transform duration-200 ${exhausted ? "rotate-90" : ""} ${selectable ? lightsaberGlow : ""} ${selectable ? "cursor-pointer" : ""}`}
    onMouseEnter={onPreviewStart ? () => onPreviewStart({ imageId: cardId, cardId, label: CardTitle(cardId) }) : undefined}
    onMouseLeave={onPreviewEnd}
    onClick={onClick}
  >
    <img src="/assets/SWUniversity_Cardback.png" alt="Resource card back" className="h-12 w-12 object-cover object-center" />
  </div>;
}

function UpgradeStrip({
  cardId,
  playId,
  selectable = false,
  onClick,
  onPreviewStart,
  onPreviewEnd,
}: {
  cardId: string;
  playId?: string;
  selectable?: boolean;
  onClick?: () => void;
  onPreviewStart: (preview: PreviewState) => void;
  onPreviewEnd: () => void;
}) {
  const imageCardId = CardIsLeader(cardId) ? `${cardId}_BACK` : cardId;
  const primarySrc = getCardImageLink(imageCardId);
  const fallbackSrc = getSWUDBImageLink(imageCardId);
  const [imageSrc, setImageSrc] = React.useState(primarySrc);
  const title = CardTitle(cardId);

  React.useEffect(() => { setImageSrc(primarySrc); }, [primarySrc]);

  const inner = (
    <div
      className={`overflow-hidden rounded-b-xl border-x border-b border-white/15 bg-black/40${selectable && onClick ? " ring-2 ring-rose-400/90 shadow-[0_0_10px_rgba(251,113,133,0.5)]" : ""}`}
      style={{ height: 18 }}
      onMouseEnter={() => onPreviewStart({ imageId: imageCardId, cardId, label: title })}
      onMouseLeave={onPreviewEnd}
    >
      <img
        src={imageSrc}
        alt={title}
        className="h-full w-full object-cover"
        style={{ objectPosition: "center 95%" }}
        onError={() => { if (imageSrc !== fallbackSrc) setImageSrc(fallbackSrc); }}
      />
    </div>
  );

  if (selectable && onClick) {
    return (
      <button type="button" className="block w-full cursor-pointer" title={title} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return inner;
}

function CaptiveStrip({
  cardId,
  onPreviewStart,
  onPreviewEnd,
}: {
  cardId: string;
  onPreviewStart: (preview: PreviewState) => void;
  onPreviewEnd: () => void;
}) {
  const title = CardTitle(cardId);

  return (
    <div
      className="overflow-hidden rounded-b-xl border-x border-b border-white/15 bg-gray-500/60"
      style={{ height: 18 }}
      onMouseEnter={() => onPreviewStart({ imageId: cardId, cardId, label: title })}
      onMouseLeave={onPreviewEnd}
    >
      <span className="block w-full text-center text-[9px] font-semibold uppercase leading-[18px] tracking-wide text-white/70">
        Captive
      </span>
    </div>
  );
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

function PuzzlesPage({ showBuilderTools = false, isAdmin = false, solvedPuzzleIds: initialSolvedPuzzleIds = [] }: { showBuilderTools?: boolean; isAdmin?: boolean; solvedPuzzleIds?: string[] }) {
  // ---------------------------------------------------------------------------
  // Engine communication refs (not React state — no re-render on change)
  // ---------------------------------------------------------------------------
  const gameIdRef = React.useRef<string | null>(null);           // server-managed mode
  const roundTripCtxRef = React.useRef<EngineContext | null>(null); // round-trip mode

  // ---------------------------------------------------------------------------
  // React state
  // ---------------------------------------------------------------------------
  const [gameState, setGameState] = React.useState<GameState | null>(null);
  const [sentinelPlayIds, setSentinelPlayIds] = React.useState<string[]>([]);
  const [unitBuffs, setUnitBuffs] = React.useState<Record<string, { power: number; hp: number }>>({});
  const [gameLog, setGameLog] = React.useState<string[]>([]);
  const [resolutionNeeded, setResolutionNeeded] = React.useState<ResolutionRequest | null>(null);
  const [isResolving, setIsResolving] = React.useState(false);
  const [historyLength, setHistoryLength] = React.useState(0);
  const [lastActionMs, setLastActionMs] = React.useState<number | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [selectedTargetPlayIds, setSelectedTargetPlayIds] = React.useState<string[]>([]);
  const [selectedTargetIndices, setSelectedTargetIndices] = React.useState<number[]>([]);
  const [spreadDmgMap, setSpreadDmgMap] = React.useState<Record<string, number>>({});
  const [selectedPuzzleFilename, setSelectedPuzzleFilename] = React.useState<string | null>(null);
  const [puzzleName, setPuzzleName] = React.useState<string | null>(null);
  const [puzzleMeta, setPuzzleMeta] = React.useState<{ name: string; author: string; inspiredBy?: string; intendedSolution: string[]; infoText?: string; description?: string; hints?: string[] } | null>(null);
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const [showSolutionModal, setShowSolutionModal] = React.useState(false);
  const [showHintsModal, setShowHintsModal] = React.useState(false);
  const [openHints, setOpenHints] = React.useState<Set<number>>(new Set());
  const [showFailModal, setShowFailModal] = React.useState(false);
  const [showBuilderPanelOpen, setShowBuilderPanelOpen] = React.useState(false);
  const [lastTestRaw, setLastTestRaw] = React.useState<any | null>(null);
  const [lastTestMeta, setLastTestMeta] = React.useState<{ name?: string; description?: string; infoText?: string; difficulty?: number; author?: string; inspiredBy?: string; intendedSolution?: string[]; hints?: string[]; assetPath?: string } | null>(null);
  const [editState, setEditState] = React.useState<{ id: string; raw: unknown; meta: { name: string; description: string; infoText: string; difficulty: number; author: string; inspiredBy?: string; intendedSolution: string[]; hints?: string[]; assetPath?: string } } | null>(null);
  const [puzzleListRefresh, setPuzzleListRefresh] = React.useState(0);
  // Read from localStorage only on the client to avoid SSR hydration mismatch.
  React.useEffect(() => {
    try { const s = localStorage.getItem(LS_TEST_RAW); if (s) setLastTestRaw(JSON.parse(s)); } catch { /* localStorage unavailable */ }
    try { const s = localStorage.getItem(LS_TEST_META); if (s) setLastTestMeta(JSON.parse(s)); } catch { /* localStorage unavailable */ }
  }, []);
  React.useEffect(() => {
    if (lastTestRaw != null) localStorage.setItem(LS_TEST_RAW, JSON.stringify(lastTestRaw));
    else localStorage.removeItem(LS_TEST_RAW);
  }, [lastTestRaw]);
  React.useEffect(() => {
    if (lastTestMeta != null) localStorage.setItem(LS_TEST_META, JSON.stringify(lastTestMeta));
    else localStorage.removeItem(LS_TEST_META);
  }, [lastTestMeta]);
  const [solvedPuzzleIds, setSolvedPuzzleIds] = React.useState<string[]>(initialSolvedPuzzleIds);
  const [showClosePuzzleConfirm, setShowClosePuzzleConfirm] = React.useState(false);
  const [leaderModalOpen, setLeaderModalOpen] = React.useState(false);
  const [unitAbilityModal, setUnitAbilityModal] = React.useState<{ playId: string; cardId: string } | null>(null);
  const [discardModalPlayer, setDiscardModalPlayer] = React.useState<1 | 2 | null>(null);
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameLogRef = React.useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const previewPrimarySrc = preview ? getCardImageLink(preview.imageId) : "";
  const previewFallbackSrc = preview ? getSWUDBImageLink(preview.imageId) : "";
  const [previewImageSrc, setPreviewImageSrc] = React.useState(previewPrimarySrc);

  const clearPreviewDismissTimer = React.useCallback(() => {
    if (previewDismissTimerRef.current) {
      clearTimeout(previewDismissTimerRef.current);
      previewDismissTimerRef.current = null;
    }
  }, []);

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
    clearPreviewDismissTimer();
    setPreview(null);
    previewTimerRef.current = setTimeout(() => {
      setPreview(nextPreview);
      previewDismissTimerRef.current = setTimeout(() => {
        setPreview(null);
      }, 10000);
    }, 700);
  }, [clearPreviewTimer, clearPreviewDismissTimer, setPreview]);
  const handlePreviewEnd = React.useCallback(() => {
    clearPreviewTimer();
    clearPreviewDismissTimer();
    setPreview(null);
  }, [clearPreviewTimer, clearPreviewDismissTimer, setPreview]);
  React.useEffect(() => () => { clearPreviewTimer(); clearPreviewDismissTimer(); }, [clearPreviewTimer, clearPreviewDismissTimer]);
  React.useEffect(() => { setSelectedTargetPlayIds([]); setSelectedTargetIndices([]); setSpreadDmgMap({}); }, [resolutionNeeded]);

  const [deckSearchSelected, setDeckSearchSelected] = React.useState<Set<string>>(new Set());
  React.useEffect(() => { if (resolutionNeeded?.type !== "DeckSearch") setDeckSearchSelected(new Set()); }, [resolutionNeeded]);
  const [nameCardSearch, setNameCardSearch] = React.useState("");
  React.useEffect(() => { setNameCardSearch(""); }, [resolutionNeeded]);
  // Scry state: ordered top tempIds + explicit bottom set; confirm enabled when all cards are assigned
  const [scryTopOrder, setScryTopOrder] = React.useState<string[]>([]);
  const [scryBottomSet, setScryBottomSet] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    if (resolutionNeeded?.type === "DeckSearch" && resolutionNeeded.action === "scry") {
      setScryTopOrder([]);
      setScryBottomSet(new Set());
    }
  }, [resolutionNeeded]);
  React.useEffect(() => {
    if (resolutionNeeded?.type === "Target" && resolutionNeeded.fromZones?.includes("Discard")) {
      setDiscardModalPlayer(1);
    }
  }, [resolutionNeeded]);
  const deckSearchCost = resolutionNeeded?.type === "DeckSearch"
    ? [...deckSearchSelected].reduce((sum, id) => {
        const c = (resolutionNeeded.choices).find(ch => ch.tempId === id);
        return sum + (c?.cost ?? 0);
      }, 0)
    : 0;

  // ---------------------------------------------------------------------------
  // Core dispatch — sends a GameDispatch to the puzzle API endpoint
  // ---------------------------------------------------------------------------
  const sendDispatch = React.useCallback(async (d: GameDispatch) => {
    if (isResolving) return;
    setIsResolving(true);
    setActionError(null);
    const t0 = performance.now();
    try {
      const body = USE_HTTP_TRANSPORT
        ? { dispatch: d, context: roundTripCtxRef.current ?? undefined }
        : { gameId: gameIdRef.current, dispatch: d };

      const res = await fetch("/api/puzzle/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: "Dispatch failed." })) as { error?: string };
        throw new Error(payload.error ?? "Dispatch failed.");
      }

      const payload = await res.json() as {
        response: DispatchResponse;
        gameLog: string[];
        currentGameState: GameState;
        historyLength: number;
        context?: EngineContext;
      };

      if (payload.context) roundTripCtxRef.current = payload.context;
      setResolutionNeeded(payload.response.resolutionNeeded ?? null);
      // Always update from currentGameState so UI reflects card placement during pending resolutions
      setGameState(payload.currentGameState ?? payload.response.newGameState ?? null);
      if (payload.response.sentinelPlayIds !== undefined) setSentinelPlayIds(payload.response.sentinelPlayIds);
      if (payload.response.unitBuffs !== undefined) setUnitBuffs(payload.response.unitBuffs);
      setGameLog(payload.gameLog);
      setHistoryLength(payload.historyLength);
      if (payload.response.invalidAction) {
        setActionError(payload.response.invalidReason ?? "Invalid action.");
      }
      setLastActionMs(Math.round(performance.now() - t0));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setIsResolving(false);
    }
  }, [isResolving]);

  // ---------------------------------------------------------------------------
  // Click handlers — translate UI events into GameDispatch calls
  // ---------------------------------------------------------------------------
  const isMultiSelectTarget = resolutionNeeded?.type === "Target" &&
    ((resolutionNeeded.needsMultiple ?? false) || (resolutionNeeded.maxTargets ?? 1) > 1);
  const isMultiSelectHand = isMultiSelectTarget && resolutionNeeded?.type === "Target"
    && resolutionNeeded.fromZones?.includes("Hand") && isOwnHandTarget(resolutionNeeded);

  const handleConfirmTargets = React.useCallback(() => {
    if (isResolving) return;
    if (isMultiSelectHand) {
      void sendDispatch(createDispatch("choose-target", { targetIndices: selectedTargetIndices }));
    } else {
      void sendDispatch(createDispatch("choose-target", { targetPlayIds: selectedTargetPlayIds }));
    }
  }, [isResolving, isMultiSelectHand, selectedTargetIndices, selectedTargetPlayIds, sendDispatch]);

  const handleUnitClick = React.useCallback((playId: string) => {
    if (isResolving) return;
    if (resolutionNeeded?.type === "Target") {
      if (isMultiSelectTarget) {
        setSelectedTargetPlayIds(prev => {
          if (prev.includes(playId)) return prev.filter(id => id !== playId);
          const max = resolutionNeeded.maxTargets ?? Infinity;
          if (prev.length >= max) return prev;
          return [...prev, playId];
        });
      } else {
        void sendDispatch(createDispatch("choose-target", { targetPlayIds: [playId] }));
      }
    } else if (!resolutionNeeded && gameState) {
      const unit =
        [...gameState.player1.groundArena, ...gameState.player1.spaceArena].find(u => u.playId === playId);
      if (unit && unit.ready && UNITS_WITH_ACTION_ABILITY[unit.cardId]) {
        setUnitAbilityModal({ playId, cardId: unit.cardId });
      } else {
        void sendDispatch(createDispatch("initiate-attack", { playId }));
      }
    }
  }, [isResolving, isMultiSelectTarget, resolutionNeeded, gameState, sendDispatch]);

  const handleUnitAttack = React.useCallback(() => {
    if (!unitAbilityModal) return;
    const { playId } = unitAbilityModal;
    setUnitAbilityModal(null);
    void sendDispatch(createDispatch("initiate-attack", { playId }));
  }, [unitAbilityModal, sendDispatch]);

  const handleUnitAbility = React.useCallback(() => {
    if (!unitAbilityModal) return;
    const { playId, cardId } = unitAbilityModal;
    setUnitAbilityModal(null);
    void sendDispatch(createDispatch("use-ability", { cardId, playId }));
  }, [unitAbilityModal, sendDispatch]);

  const handleBaseClick = React.useCallback((_player: PlayerId) => {
    if (isResolving) return;
    if (resolutionNeeded?.type === "Target" && resolutionNeeded.fromZones?.includes("Base")) {
      void sendDispatch(createDispatch("choose-target", { targetZones: ["Base"] }));
    } else if (!resolutionNeeded && gameState && BASES_WITH_EPIC_ACTION.has(gameState.player1.base.cardId)) {
      void sendDispatch(createDispatch("use-ability", { cardId: gameState.player1.base.cardId }));
    }
  }, [isResolving, resolutionNeeded, gameState, sendDispatch]);

  const handleHandClick = React.useCallback((index: number, cardId: string) => {
    if (isResolving) return;
    if (resolutionNeeded?.type === "Target" && resolutionNeeded.fromZones?.includes("Hand")
        && isOwnHandTarget(resolutionNeeded)) {
      if (isMultiSelectHand) {
        setSelectedTargetIndices(prev => {
          if (prev.includes(index)) return prev.filter(i => i !== index);
          const max = resolutionNeeded.maxTargets ?? Infinity;
          if (prev.length >= max) return prev;
          return [...prev, index];
        });
      } else {
        void sendDispatch(createDispatch("choose-target", { targetIndices: [index] }));
      }
    } else if (!resolutionNeeded) {
      void sendDispatch(createDispatch("play-card", { cardId, fromZone: "Hand" }));
    }
  }, [isResolving, isMultiSelectHand, resolutionNeeded, sendDispatch]);

  const handleLeaderAbility = React.useCallback(() => {
    if (!gameState) return;
    setLeaderModalOpen(false);
    void sendDispatch(createDispatch("use-ability", { cardId: gameState.player1.leader.cardId }));
  }, [gameState, sendDispatch]);

  const handleLeaderDeploy = React.useCallback(() => {
    if (!gameState) return;
    setLeaderModalOpen(false);
    void sendDispatch(createDispatch("use-ability", {
      cardId: gameState.player1.leader.cardId,
      epicAction: true,
      deployLeader: true,
    }));
  }, [gameState, sendDispatch]);

  const handleSpreadIncrement = React.useCallback((playId: string) => {
    setSpreadDmgMap(prev => ({ ...prev, [playId]: (prev[playId] ?? 0) + 1 }));
  }, []);

  const handleSpreadDecrement = React.useCallback((playId: string) => {
    setSpreadDmgMap(prev => {
      const next = { ...prev, [playId]: Math.max(0, (prev[playId] ?? 0) - 1) };
      if (next[playId] === 0) delete next[playId];
      return next;
    });
  }, []);

  const handleSpreadConfirm = React.useCallback((assignments: { playId: string; damage: number }[]) => {
    void sendDispatch(createDispatch("choose-target", { spreadDamageAssignments: assignments }));
  }, [sendDispatch]);

  const handleDeckSearchConfirm = React.useCallback(() => {
    void sendDispatch(createDispatch("choose-target", { targetPlayIds: [...deckSearchSelected] }));
  }, [deckSearchSelected, sendDispatch]);

  const handleScryTop = React.useCallback((tempId: string) => {
    setScryBottomSet(prev => { const s = new Set(prev); s.delete(tempId); return s; });
    setScryTopOrder(prev => prev.includes(tempId) ? prev.filter(id => id !== tempId) : [...prev, tempId]);
  }, []);

  const handleScryBottom = React.useCallback((tempId: string) => {
    setScryTopOrder(prev => prev.filter(id => id !== tempId));
    setScryBottomSet(prev => new Set([...prev, tempId]));
  }, []);

  const handleScryConfirm = React.useCallback(() => {
    void sendDispatch(createDispatch("choose-target", { targetPlayIds: scryTopOrder }));
  }, [scryTopOrder, sendDispatch]);

  const handleOptionChoice = React.useCallback((option: string) => {
    void sendDispatch(createDispatch("choose-option", { option }));
  }, [sendDispatch]);

  const handleTriggerChoice = React.useCallback((cardId: string) => {
    void sendDispatch(createDispatch("choose-trigger", { cardId }));
  }, [sendDispatch]);

  const handlePlayerChoice = React.useCallback((playerId: PlayerId) => {
    void sendDispatch(createDispatch("choose-player", { playerId }));
  }, [sendDispatch]);

  const handlePass = React.useCallback(() => {
    void sendDispatch(createDispatch("pass-action", {}));
  }, [sendDispatch]);

  const handleClaimInitiative = React.useCallback(() => {
    void sendDispatch(createDispatch("claim-initiative", {}));
  }, [sendDispatch]);

  // ---------------------------------------------------------------------------
  // Undo — revert to the previous committed game state
  // ---------------------------------------------------------------------------
  const handleUndo = React.useCallback(async () => {
    if (isResolving || historyLength === 0) return;
    setIsResolving(true);
    setActionError(null);
    try {
      const body = USE_HTTP_TRANSPORT
        ? { context: roundTripCtxRef.current ?? undefined }
        : { gameId: gameIdRef.current };

      const res = await fetch("/api/puzzle/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: "Undo failed." })) as { error?: string };
        throw new Error(payload.error ?? "Undo failed.");
      }

      const payload = await res.json() as {
        gameState: GameState;
        gameLog: string[];
        historyLength: number;
        sentinelPlayIds: string[];
        unitBuffs?: Record<string, { power: number; hp: number }>;
        context?: EngineContext;
      };

      if (payload.context) roundTripCtxRef.current = payload.context;
      setGameState(payload.gameState);
      setSentinelPlayIds(payload.sentinelPlayIds ?? []);
      setUnitBuffs(payload.unitBuffs ?? {});
      setGameLog(payload.gameLog);
      setHistoryLength(payload.historyLength);
      setResolutionNeeded(null);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Undo failed.");
    } finally {
      setIsResolving(false);
    }
  }, [isResolving, historyLength]);

  // ---------------------------------------------------------------------------
  // Load puzzle — fetch initial GameState and register/seed the engine session
  // ---------------------------------------------------------------------------
  const loadPuzzle = React.useCallback(async (filename: string) => {
    setIsResolving(true);
    setActionError(null);
    try {
      const r = await fetch(`/api/puzzles?id=${encodeURIComponent(filename)}`);
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Load failed");
      const { gameState: initialState, sentinelPlayIds: initialSentinelIds, unitBuffs: initialUnitBuffs } = await r.json() as { gameState: GameState; sentinelPlayIds: string[]; unitBuffs?: Record<string, { power: number; hp: number }> };

      if (USE_HTTP_TRANSPORT) {
        // Round-trip mode: seed the initial context locally; no server registration needed
        roundTripCtxRef.current = {
          game: {
            id: globalThis.crypto.randomUUID(),
            currentGameState: initialState,
            gameStateHistory: [],
            gameLog: [`Puzzle loaded.`],
          },
          pending: null,
        } as EngineContext;
        gameIdRef.current = null;
      } else {
        // Server-managed mode: register the initial state in the game-store
        const newGameRes = await fetch("/api/engine/new-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withGameState: initialState }),
        });
        if (!newGameRes.ok) throw new Error("Failed to create game session.");
        const { gameId } = await newGameRes.json() as { gameId: string };
        gameIdRef.current = gameId;
        roundTripCtxRef.current = null;
      }

      setGameState(initialState);
      setSentinelPlayIds(initialSentinelIds ?? []);
      setUnitBuffs(initialUnitBuffs ?? {});
      setGameLog([`Puzzle loaded.`]);
      setResolutionNeeded(null);
      setActionError(null);
      setHistoryLength(0);
      setOpenHints(new Set());
      setShowHintsModal(false);
      setShowFailModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setIsResolving(false);
    }
  }, []);

  // Always call hooks before any return
  React.useEffect(() => {
    setPreviewImageSrc(previewPrimarySrc);
  }, [previewPrimarySrc, setPreviewImageSrc]);

  // Show solution modal and mark solved when puzzle is won
  React.useEffect(() => {
    if (gameState && deriveStatus(gameState) === "won" && puzzleMeta) {
      setShowSolutionModal(true);
      if (selectedPuzzleFilename) {
        setSolvedPuzzleIds(prev => [...new Set([...prev, selectedPuzzleFilename])]);
        void fetch("/api/puzzles/mark-solved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ puzzleId: selectedPuzzleFilename }),
        });
      }
    }
  }, [gameState, puzzleMeta, selectedPuzzleFilename]);

  // Show failure modal when the puzzle is lost or ends in a draw
  React.useEffect(() => {
    if (gameState) {
      const s = deriveStatus(gameState);
      if (s === "lost" || s === "draw") setShowFailModal(true);
    }
  }, [gameState]);

  // Auto-scroll game log to bottom when entries change
  React.useEffect(() => {
    const el = gameLogRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } catch (err) {
      el.scrollTop = el.scrollHeight;
    }
  }, [gameLog]);

  const isHealMode = resolutionNeeded?.type === "SpreadDamage" && resolutionNeeded.mode === "heal";
  // Must be declared before the early return so the hook call order is stable.
  const healCapMap = React.useMemo<Record<string, number>>(() => {
    if (!isHealMode || !gameState) return {};
    const map: Record<string, number> = {};
    for (const u of [...gameState.player1.groundArena, ...gameState.player1.spaceArena,
                      ...gameState.player2.groundArena, ...gameState.player2.spaceArena]) {
      map[u.playId] = u.damage;
    }
    map["player1.base"] = gameState.player1.base.damage;
    map["player2.base"] = gameState.player2.base.damage;
    return map;
  }, [isHealMode, gameState]);

  if (!gameState) {
    return <div className="relative z-10 mx-auto w-full max-w-[1920px] px-3 py-4 text-white sm:px-4 lg:px-6">
      {showBuilderPanelOpen && showBuilderTools ? (
        <PuzzleBuilderPanel
          onClose={() => { setShowBuilderPanelOpen(false); setEditState(null); }}
          onSaved={(_id) => {
            setShowBuilderPanelOpen(false);
            setEditState(null);
            setPuzzleListRefresh((n) => n + 1);
          }}
          initialId={editState?.id}
          initialRaw={editState?.raw ?? lastTestRaw ?? undefined}
          initialMeta={editState?.meta ?? lastTestMeta ?? undefined}
          onTest={async (payload: any) => {
            // payload: { rawInitial, gameState, sentinelPlayIds, unitBuffs }
            // remember raw for editing
            const raw = payload.rawInitial ?? null;
            setLastTestRaw(raw);
            setLastTestMeta({ name: payload.name ?? undefined, description: payload.description ?? undefined, infoText: payload.infoText ?? undefined, difficulty: payload.difficulty ?? undefined, author: payload.author ?? undefined, inspiredBy: payload.inspiredBy ?? undefined, intendedSolution: payload.intendedSolution ?? undefined, hints: payload.hints ?? undefined, assetPath: payload.assetPath ?? undefined });

            setIsResolving(true);
            setActionError(null);
            try {
              const initialState = payload.gameState as typeof gameState;
              const initialSentinelIds = payload.sentinelPlayIds ?? [];
              const initialUnitBuffs = payload.unitBuffs ?? {};

              if (USE_HTTP_TRANSPORT) {
                roundTripCtxRef.current = {
                  game: {
                    id: globalThis.crypto.randomUUID(),
                    currentGameState: initialState as unknown as GameState,
                    gameStateHistory: [],
                    gameLog: ["Puzzle test loaded."],
                  },
                  pending: null,
                } as EngineContext;
                gameIdRef.current = null;
              } else {
                const newGameRes = await fetch("/api/engine/new-game", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ withGameState: initialState }),
                });
                if (!newGameRes.ok) throw new Error("Failed to create game session.");
                const { gameId } = await newGameRes.json() as { gameId: string };
                gameIdRef.current = gameId;
                roundTripCtxRef.current = null;
              }

              setGameState(initialState);
              setSentinelPlayIds(initialSentinelIds);
              setUnitBuffs(initialUnitBuffs);
              setGameLog(["Puzzle test loaded."]);
              setResolutionNeeded(null);
              setActionError(null);
              setHistoryLength(0);
              // close builder and show puzzle UI immediately
              setShowBuilderPanelOpen(false);
              const title = payload.name ?? lastTestMeta?.name ?? "Tested Puzzle";
              setPuzzleName(title);
              setPuzzleMeta({ name: title, author: payload.author ?? "", inspiredBy: payload.inspiredBy ?? undefined, intendedSolution: payload.intendedSolution ?? [], infoText: payload.infoText ?? undefined, description: payload.description ?? undefined, hints: payload.hints ?? [] });
              setShowInfoModal(Boolean(payload.infoText && String(payload.infoText).trim()));
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "Test failed.");
            } finally {
              setIsResolving(false);
            }
          }}
        />
      ) : null}
      <div className="mb-3 flex flex-col gap-3">
        {showBuilderTools ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setLastTestRaw(null); setEditState(null); setShowBuilderPanelOpen(true); }}
              className="self-start rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500/25"
            >
              Build New Puzzle
            </button>
            {lastTestRaw ? (
              <button
                type="button"
                onClick={() => { setEditState(null); setShowBuilderPanelOpen(true); }}
                className="self-start rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500/20"
              >
                Edit Tested Puzzle
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <LoadPuzzlePanel
            onPuzzleLoaded={(filename, meta) => {
              setSelectedPuzzleFilename(filename);
              setPuzzleName(meta.name);
              setPuzzleMeta({ name: meta.name, author: meta.author, inspiredBy: meta.inspiredBy, intendedSolution: meta.intendedSolution, infoText: meta.infoText, description: meta.description, hints: meta.hints ?? [] });
              setShowSolutionModal(false);
              setShowInfoModal(Boolean(meta.infoText && meta.infoText.trim()));
              void loadPuzzle(filename);
            }}
            onEditPuzzle={(entry) => {
              setEditState({
                id: entry.id,
                raw: entry.initialGamestate,
                meta: {
                  name: entry.name,
                  description: entry.description,
                  infoText: entry.infoText,
                  difficulty: entry.difficulty,
                  author: entry.author,
                  inspiredBy: entry.inspiredBy,
                  intendedSolution: entry.intendedSolution,
                  hints: entry.hints,
                  assetPath: entry.assetPath,
                },
              });
              setShowBuilderPanelOpen(true);
            }}
            isAdmin={isAdmin}
            solvedPuzzleIds={solvedPuzzleIds}
            refreshSignal={puzzleListRefresh}
          />
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-white/60">Select a puzzle to get started.</p>
    </div>;
  }

  const player = gameState.player1;
  const opponent = gameState.player2;
  const status = deriveStatus(gameState);
  const isGameOver = status !== "playing";

  const selectablePlayIds = resolutionNeeded?.type === "Target"
    ? (resolutionNeeded.fromPlayIds ?? [])
    : !resolutionNeeded && !isGameOver
      ? [
          ...player.groundArena.filter((u) => u.ready).map((u) => u.playId),
          ...player.spaceArena.filter((u) => u.ready).map((u) => u.playId),
        ]
      : [];
  const selectableUpgradePlayIds: Set<string> =
    resolutionNeeded?.type === "Target" && (resolutionNeeded.fromPlayIds ?? []).length > 0
      ? new Set(
          [
            ...gameState.player1.groundArena,
            ...gameState.player1.spaceArena,
            ...gameState.player2.groundArena,
            ...gameState.player2.spaceArena,
          ]
            .flatMap(u => u.upgrades)
            .filter(upg => (resolutionNeeded.fromPlayIds ?? []).includes(upg.playId))
            .map(upg => upg.playId)
        )
      : new Set();
  const spreadEligiblePlayIds: Set<string> = resolutionNeeded?.type === "SpreadDamage"
    ? new Set(resolutionNeeded.eligiblePlayIds)
    : new Set();
  const spreadAssigned = Object.values(spreadDmgMap).reduce((s, v) => s + v, 0);
  const spreadCanConfirm = resolutionNeeded?.type === "SpreadDamage"
    ? isHealMode
      ? spreadAssigned <= resolutionNeeded.totalDamage
      : (resolutionNeeded.optional ? spreadAssigned === 0 || spreadAssigned === resolutionNeeded.totalDamage : spreadAssigned === resolutionNeeded.totalDamage)
    : false;

  const isSpreadIncrementDisabled = (playId: string): boolean => {
    if (resolutionNeeded?.type !== "SpreadDamage") return true;
    if (spreadAssigned >= resolutionNeeded.totalDamage) return true;
    if (isHealMode && (spreadDmgMap[playId] ?? 0) >= (healCapMap[playId] ?? 0)) return true;
    return false;
  };

  const spreadBtnClass = isHealMode
    ? "rounded bg-sky-700 px-1.5 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-30"
    : "rounded bg-rose-700 px-1.5 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-30";
  const spreadValueClass = isHealMode
    ? "min-w-[1.4rem] text-center text-xs font-bold text-sky-300"
    : "min-w-[1.4rem] text-center text-xs font-bold text-rose-300";
  const spreadBaseControls = (basePlayId: string) =>
    spreadEligiblePlayIds.has(basePlayId) ? (
      <div className="mt-1 flex items-center justify-center gap-0.5">
        <button type="button" onClick={() => handleSpreadDecrement(basePlayId)} disabled={(spreadDmgMap[basePlayId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
        <span className={spreadValueClass}>{spreadDmgMap[basePlayId] ?? 0}</span>
        <button type="button" onClick={() => handleSpreadIncrement(basePlayId)} disabled={isSpreadIncrementDisabled(basePlayId)} className={spreadBtnClass}>+</button>
      </div>
    ) : null;

  const selectableBaseForPlayer: PlayerId[] = resolutionNeeded?.type === "Target" && resolutionNeeded.fromZones?.includes("Base")
    ? [2]
    : [];
  // Clickable if deploy is still available (even exhausted) OR ability is ready
  const uiCanClickLeader = !resolutionNeeded && !isGameOver && !player.leader.deployed &&
    (player.leader.ready || !player.leader.epicActionUsed);
  const uiCanClickBase = !resolutionNeeded && !isGameOver &&
    BASES_WITH_EPIC_ACTION.has(player.base.cardId) && !player.base.epicActionUsed;
  const selectableHandIndices: number[] = resolutionNeeded?.type === "Target" && resolutionNeeded.fromZones?.includes("Hand")
    ? (isOwnHandTarget(resolutionNeeded) ? (resolutionNeeded.fromIndices ?? player.hand.map((_, i) => i)) : [])
    : !resolutionNeeded && !isGameOver
      ? player.hand.map((_, i) => i).filter(i => CardIsPlayable(gameState, PLAYER, player.hand[i].cardId))
      : [];
  const smuggleablePlayIds: Set<string> = !resolutionNeeded && !isGameOver
    ? new Set(player.resources.filter(r => ResourceIsSmuggleable(gameState, PLAYER, r)).map(r => r.playId))
    : new Set();

  const selectableDiscardPlayIds: Set<string> = resolutionNeeded?.type === "Target" && resolutionNeeded.fromZones?.includes("Discard")
    ? new Set(resolutionNeeded.fromPlayIds ?? [])
    : new Set();
  const hasDiscardSelection = selectableDiscardPlayIds.size > 0;

  const latestEnemyDiscard = opponent.discard.length > 0 ? opponent.discard[0] : null;
  const latestPlayerDiscard = player.discard.length > 0 ? player.discard[0] : null;
  const isNameCardPrompt = resolutionNeeded?.type === "Target" && (resolutionNeeded.fromChoices?.length ?? 0) > 0;
  const hasPrompt = resolutionNeeded?.type === "Option" || resolutionNeeded?.type === "Trigger" || resolutionNeeded?.type === "Player" || resolutionNeeded?.type === "DeckSearch" || resolutionNeeded?.type === "PeekHand" || isNameCardPrompt;
  const hasPlotPrompt = resolutionNeeded?.type === "Plot";
  const getUnitGlowClass = (playId: string) =>
    isMultiSelectTarget && selectedTargetPlayIds.includes(playId)
      ? "ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.5)]"
      : isMultiSelectTarget && selectablePlayIds.includes(playId)
        ? "ring-2 ring-rose-400/90 shadow-[0_0_10px_rgba(251,113,133,0.5)]"
        : undefined;
  const statusTone = status === "won"
    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
    : status === "lost"
      ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
      : status === "draw"
        ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
        : "border-white/10 bg-white/5 text-white";

  return <div className="relative z-10 mx-auto w-full max-w-[1920px] px-3 py-4 text-white sm:px-4 lg:px-6">
    {showBuilderPanelOpen && showBuilderTools ? (
      <PuzzleBuilderPanel
        onClose={() => { setShowBuilderPanelOpen(false); setEditState(null); }}
        onSaved={(_id) => {
          setShowBuilderPanelOpen(false);
          setEditState(null);
          setPuzzleListRefresh((n) => n + 1);
          setActionError(`Puzzle saved.`);
        }}
        initialId={editState?.id}
        initialRaw={editState?.raw ?? undefined}
        initialMeta={editState?.meta ?? undefined}
      />
    ) : null}
    {showBuilderTools && !gameState ? (
      <div className="mb-3 flex items-start gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <LoadPuzzlePanel
          onPuzzleLoaded={(filename, meta) => {
            setSelectedPuzzleFilename(filename);
            setPuzzleName(meta.name);
            setPuzzleMeta({ name: meta.name, author: meta.author, inspiredBy: meta.inspiredBy, intendedSolution: meta.intendedSolution, infoText: meta.infoText, description: meta.description, hints: meta.hints ?? [] });
            setShowSolutionModal(false);
            setShowInfoModal(Boolean(meta.infoText && meta.infoText.trim()));
            void loadPuzzle(filename);
          }}
          onEditPuzzle={(entry) => {
            setEditState({
              id: entry.id,
              raw: entry.initialGamestate,
              meta: {
                name: entry.name,
                description: entry.description,
                infoText: entry.infoText,
                difficulty: entry.difficulty,
                author: entry.author,
                inspiredBy: entry.inspiredBy,
                intendedSolution: entry.intendedSolution,
              },
            });
            setShowBuilderPanelOpen(true);
          }}
          isAdmin={isAdmin}
          solvedPuzzleIds={solvedPuzzleIds}
          refreshSignal={puzzleListRefresh}
        />
        <button
          type="button"
          onClick={() => { setEditState(null); setShowBuilderPanelOpen(true); }}
          className="shrink-0 self-start rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500/25"
        >
          Build New Puzzle
        </button>
      </div>
    ) : null}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-[0.24em] text-white sm:text-3xl">{puzzleName ?? "Puzzle Mode"}</h1>
        {!puzzleName ? <p className="mt-1 text-xs text-white/65 sm:text-sm">Board-first tactical sandbox. Opponent already has initiative.</p> : null}
        {puzzleMeta?.author ? <p className="mt-0.5 text-xs text-white/45">By {puzzleMeta.author}{puzzleMeta.inspiredBy ? <span className="ml-2 text-white/30">· Inspired by {puzzleMeta.inspiredBy}</span> : null}</p> : null}
      </div>
      {showClosePuzzleConfirm ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">Close puzzle?</span>
          <button
            type="button"
            onClick={() => { setGameState(null); setPuzzleName(null); setPuzzleMeta(null); setShowInfoModal(false); setShowClosePuzzleConfirm(false); setActionError(null); }}
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
            <span className="text-[10px] text-white/50">{gameLog.length}</span>
          </div>
          <div ref={gameLogRef} className="h-[23vh] space-y-1.5 overflow-y-auto pr-1 text-[10px] leading-4 text-white/80">
            {gameLog.map((entry, index) => <div key={`${entry}-${index}`} className="rounded-md bg-black/25 px-1.5 py-1"><CardLinkText text={entry} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} /></div>)}
          </div>
        </section>
        <SectionShell title="Actions" className="mt-2 rounded-lg p-2">
          <div className="mt-2 grid gap-1.5">
            {puzzleMeta?.infoText && puzzleMeta.infoText.trim() ? (
              <button type="button" onClick={() => setShowInfoModal(true)} className="rounded-lg border border-sky-400/30 bg-sky-500/15 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-sky-500/25">Puzzle Info</button>
            ) : null}
            <button type="button" onClick={() => void handleUndo()} disabled={isResolving || historyLength === 0} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
            <button type="button" onClick={handlePass} disabled={isResolving || isGameOver || !!resolutionNeeded} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Pass</button>
            <button type="button" onClick={handleClaimInitiative} disabled={isResolving || gameState.initiativeClaimed || isGameOver || !!resolutionNeeded} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Initiative</button>
            {(puzzleMeta?.hints?.length ?? 0) > 0 ? (
              <button type="button" onClick={() => setShowHintsModal(true)} className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-amber-500/25">Hints</button>
            ) : null}
            <div className="h-3" />
            <button type="button" onClick={() => { if (selectedPuzzleFilename !== null) void loadPuzzle(selectedPuzzleFilename); }} disabled={isResolving || selectedPuzzleFilename === null} className="rounded-lg border border-white/15 bg-rose-500/20 px-2 py-1.5 text-left text-[11px] font-semibold text-white transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40">Reset</button>
          </div>
          <div className={`mt-1 text-[10px] ${lastActionMs !== null && lastActionMs > 600 ? "text-amber-200" : "text-white/55"}`}>
            {isResolving ? "Resolving..." : lastActionMs !== null ? `Last action ${lastActionMs} ms` : "Last action --"}
          </div>
        </SectionShell>
        <SectionShell title="Initiative" className="mt-2 rounded-lg p-2">
          <div className="mt-2 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] text-white/75">
            {gameState.initiativePlayer === 1 ? "Player" : "Enemy"}
          </div>
        </SectionShell>
        <SectionShell title="Status" className="mt-2 rounded-lg p-2">
          <div className={`mt-2 rounded-lg border px-2 py-1.5 text-[10px] ${statusTone}`}>
            <div>{formatStatus(status, resolutionNeeded)}</div>
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
                {latestEnemyDiscard ? <button type="button" className="w-24 text-left" onClick={() => setDiscardModalPlayer(2)}>
                  <CardVisual
                    cardId={latestEnemyDiscard.cardId}
                    selectable={false}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                  />
                </button> : <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/40">Empty</div>}
                <div className="mt-2 text-xs text-white/70">{opponent.discard.length} total</div>
              </div>
            </div>

            <div className="space-y-2 xl:hidden">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-row-reverse flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.spaceArena.map((unit) => <div key={unit.playId} className="relative w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      customGlowClass={getUnitGlowClass(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => handleUnitClick(unit.playId) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      buff={unitBuffs[unit.playId]}
                      square
                    />
                    {unit.upgrades.map((upgrade) => {
                      const isSelectable = selectableUpgradePlayIds.has(upgrade.playId);
                      return (
                        <UpgradeStrip
                          key={upgrade.playId}
                          cardId={upgrade.cardId}
                          playId={upgrade.playId}
                          selectable={isSelectable}
                          onClick={isSelectable ? () => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [upgrade.playId] })) : undefined}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      );
                    })}{(unit.captives ?? []).map((captive) => <CaptiveStrip key={captive.playId} cardId={captive.cardId} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />)}
                    {spreadEligiblePlayIds.has(unit.playId) && (
                      <div className="absolute left-0 right-0 top-[3.6rem] z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5">
                        <button type="button" onClick={() => handleSpreadDecrement(unit.playId)} disabled={(spreadDmgMap[unit.playId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
                        <span className={spreadValueClass}>{spreadDmgMap[unit.playId] ?? 0}</span>
                        <button type="button" onClick={() => handleSpreadIncrement(unit.playId)} disabled={isSpreadIncrementDisabled(unit.playId)} className={spreadBtnClass}>+</button>
                      </div>
                    )}
                  </div>)}
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Ground</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.groundArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.groundArena.map((unit) => <div key={unit.playId} className="relative w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      customGlowClass={getUnitGlowClass(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => handleUnitClick(unit.playId) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      buff={unitBuffs[unit.playId]}
                      square
                    />
                    {unit.upgrades.map((upgrade) => {
                      const isSelectable = selectableUpgradePlayIds.has(upgrade.playId);
                      return (
                        <UpgradeStrip
                          key={upgrade.playId}
                          cardId={upgrade.cardId}
                          playId={upgrade.playId}
                          selectable={isSelectable}
                          onClick={isSelectable ? () => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [upgrade.playId] })) : undefined}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      );
                    })}{(unit.captives ?? []).map((captive) => <CaptiveStrip key={captive.playId} cardId={captive.cardId} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />)}
                    {spreadEligiblePlayIds.has(unit.playId) && (
                      <div className="absolute left-0 right-0 top-[3.6rem] z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5">
                        <button type="button" onClick={() => handleSpreadDecrement(unit.playId)} disabled={(spreadDmgMap[unit.playId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
                        <span className={spreadValueClass}>{spreadDmgMap[unit.playId] ?? 0}</span>
                        <button type="button" onClick={() => handleSpreadIncrement(unit.playId)} disabled={isSpreadIncrementDisabled(unit.playId)} className={spreadBtnClass}>+</button>
                      </div>
                    )}
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
                    epicUsed={opponent.leader.epicActionUsed}
                  /></div> : <div className="mx-auto w-full max-w-[140px] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={opponent.base.cardId}
                    selectable={selectableBaseForPlayer.includes(2)}
                    onClick={selectableBaseForPlayer.includes(2) ? () => handleBaseClick(2) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                    centerDamageBadge={opponent.base.damage}
                    epicUsed={opponent.base.epicActionUsed}
                    forceToken={opponent.supplemental.forceToken}
                  />{spreadBaseControls("player2.base")}</div>
                </div>
              </div>
            </div>

            <div className="hidden gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_165px_minmax(0,1fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-row-reverse flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.spaceArena.map((unit) => <div key={unit.playId} className="relative w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      customGlowClass={getUnitGlowClass(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => handleUnitClick(unit.playId) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      buff={unitBuffs[unit.playId]}
                      square
                    />
                    {unit.upgrades.map((upgrade) => {
                      const isSelectable = selectableUpgradePlayIds.has(upgrade.playId);
                      return (
                        <UpgradeStrip
                          key={upgrade.playId}
                          cardId={upgrade.cardId}
                          playId={upgrade.playId}
                          selectable={isSelectable}
                          onClick={isSelectable ? () => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [upgrade.playId] })) : undefined}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      );
                    })}{(unit.captives ?? []).map((captive) => <CaptiveStrip key={captive.playId} cardId={captive.cardId} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />)}
                    {spreadEligiblePlayIds.has(unit.playId) && (
                      <div className="absolute left-0 right-0 top-[3.6rem] z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5">
                        <button type="button" onClick={() => handleSpreadDecrement(unit.playId)} disabled={(spreadDmgMap[unit.playId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
                        <span className={spreadValueClass}>{spreadDmgMap[unit.playId] ?? 0}</span>
                        <button type="button" onClick={() => handleSpreadIncrement(unit.playId)} disabled={isSpreadIncrementDisabled(unit.playId)} className={spreadBtnClass}>+</button>
                      </div>
                    )}
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
                    epicUsed={opponent.leader.epicActionUsed}
                  /></div> : <div className="mx-auto w-full max-w-[140px] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={opponent.base.cardId}
                    selectable={selectableBaseForPlayer.includes(2)}
                    onClick={selectableBaseForPlayer.includes(2) ? () => handleBaseClick(2) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                    centerDamageBadge={opponent.base.damage}
                    epicUsed={opponent.base.epicActionUsed}
                    forceToken={opponent.supplemental.forceToken}
                  />{spreadBaseControls("player2.base")}</div>
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
                    epicUsed={opponent.leader.epicActionUsed}
                  /> : <div className="rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="relative">
                    <CardVisual
                      cardId={opponent.base.cardId}
                      selectable={selectableBaseForPlayer.includes(2)}
                      onClick={selectableBaseForPlayer.includes(2) ? () => handleBaseClick(2) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      compact
                      cardScale90
                      centerDamageBadge={opponent.base.damage}
                      epicUsed={opponent.base.epicActionUsed}
                      forceToken={opponent.supplemental.forceToken}
                    />
                    {spreadBaseControls("player2.base")}
                  </div>
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Ground</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.groundArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.groundArena.map((unit) => <div key={unit.playId} className="relative w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      customGlowClass={getUnitGlowClass(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => handleUnitClick(unit.playId) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      buff={unitBuffs[unit.playId]}
                      square
                    />
                    {unit.upgrades.map((upgrade) => {
                      const isSelectable = selectableUpgradePlayIds.has(upgrade.playId);
                      return (
                        <UpgradeStrip
                          key={upgrade.playId}
                          cardId={upgrade.cardId}
                          playId={upgrade.playId}
                          selectable={isSelectable}
                          onClick={isSelectable ? () => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [upgrade.playId] })) : undefined}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      );
                    })}{(unit.captives ?? []).map((captive) => <CaptiveStrip key={captive.playId} cardId={captive.cardId} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />)}
                    {spreadEligiblePlayIds.has(unit.playId) && (
                      <div className="absolute left-0 right-0 top-[3.6rem] z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5">
                        <button type="button" onClick={() => handleSpreadDecrement(unit.playId)} disabled={(spreadDmgMap[unit.playId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
                        <span className={spreadValueClass}>{spreadDmgMap[unit.playId] ?? 0}</span>
                        <button type="button" onClick={() => handleSpreadIncrement(unit.playId)} disabled={isSpreadIncrementDisabled(unit.playId)} className={spreadBtnClass}>+</button>
                      </div>
                    )}
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
                    onClick={uiCanClickLeader ? () => { if (LEADERS_WITH_ACTION_ABILITY.has(player.leader.cardId) && player.leader.ready) { setLeaderModalOpen(true); } else { handleLeaderDeploy(); } } : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!player.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                    epicUsed={player.leader.epicActionUsed}
                  /></div> : <div className="mx-auto w-full max-w-[140px] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={player.base.cardId}
                    selectable={uiCanClickBase || selectableBaseForPlayer.includes(1)}
                    onClick={uiCanClickBase || selectableBaseForPlayer.includes(1) ? () => handleBaseClick(1) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                    centerDamageBadge={player.base.damage}
                    epicUsed={player.base.epicActionUsed}
                    forceToken={player.supplemental.forceToken}
                  />{spreadBaseControls("player1.base")}</div>
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Ground</div>
                <div className="relative z-10 flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {player.groundArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {player.groundArena.map((unit) => <div key={unit.playId} className="relative w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      imageId={getPreviewImageId(unit.cardId, CardIsLeader(unit.cardId))}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      customGlowClass={getUnitGlowClass(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => handleUnitClick(unit.playId) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      buff={unitBuffs[unit.playId]}
                      square
                    />
                    {unit.upgrades.map((upgrade) => {
                      const isSelectable = selectableUpgradePlayIds.has(upgrade.playId);
                      return (
                        <UpgradeStrip
                          key={upgrade.playId}
                          cardId={upgrade.cardId}
                          playId={upgrade.playId}
                          selectable={isSelectable}
                          onClick={isSelectable ? () => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [upgrade.playId] })) : undefined}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      );
                    })}{(unit.captives ?? []).map((captive) => <CaptiveStrip key={captive.playId} cardId={captive.cardId} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />)}
                    {spreadEligiblePlayIds.has(unit.playId) && (
                      <div className="absolute left-0 right-0 top-[3.6rem] z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5">
                        <button type="button" onClick={() => handleSpreadDecrement(unit.playId)} disabled={(spreadDmgMap[unit.playId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
                        <span className={spreadValueClass}>{spreadDmgMap[unit.playId] ?? 0}</span>
                        <button type="button" onClick={() => handleSpreadIncrement(unit.playId)} disabled={isSpreadIncrementDisabled(unit.playId)} className={spreadBtnClass}>+</button>
                      </div>
                    )}
                  </div>)}
                </div>
              </div>

              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-row-reverse flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {player.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {player.spaceArena.map((unit) => {
                    const isLeader = CardIsLeader(unit.cardId);
                    return <div key={unit.playId} className="relative w-24 shrink-0">
                      <CardVisual
                        cardId={unit.cardId}
                        imageId={getPreviewImageId(unit.cardId, isLeader)}
                        selectable={selectablePlayIds.includes(unit.playId)}
                        customGlowClass={getUnitGlowClass(unit.playId)}
                        onClick={selectablePlayIds.includes(unit.playId) ? () => handleUnitClick(unit.playId) : undefined}
                        onPreviewStart={handlePreviewStart}
                        onPreviewEnd={handlePreviewEnd}
                        exhausted={!unit.ready}
                        damage={unit.damage}
                        compact
                        arenaScale60
                        sentinel={sentinelPlayIds.includes(unit.playId)}
                        buff={unitBuffs[unit.playId]}
                        square
                      />
                      {unit.upgrades.map((upgrade) => {
                      const isSelectable = selectableUpgradePlayIds.has(upgrade.playId);
                      return (
                        <UpgradeStrip
                          key={upgrade.playId}
                          cardId={upgrade.cardId}
                          playId={upgrade.playId}
                          selectable={isSelectable}
                          onClick={isSelectable ? () => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [upgrade.playId] })) : undefined}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      );
                    })}{(unit.captives ?? []).map((captive) => <CaptiveStrip key={captive.playId} cardId={captive.cardId} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />)}
                    {spreadEligiblePlayIds.has(unit.playId) && (
                      <div className="absolute left-0 right-0 top-[3.6rem] z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5">
                        <button type="button" onClick={() => handleSpreadDecrement(unit.playId)} disabled={(spreadDmgMap[unit.playId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
                        <span className={spreadValueClass}>{spreadDmgMap[unit.playId] ?? 0}</span>
                        <button type="button" onClick={() => handleSpreadIncrement(unit.playId)} disabled={isSpreadIncrementDisabled(unit.playId)} className={spreadBtnClass}>+</button>
                      </div>
                    )}
                    </div>})
                  }
                </div>
              </div>
            </div>

            <div className="hidden gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_165px_minmax(0,1fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibond uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-row-reverse flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {player.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {player.spaceArena.map((unit) => <div key={unit.playId} className="relative w-24 shrink-0">
                    <CardVisual
                      cardId={unit.cardId}
                      imageId={getPreviewImageId(unit.cardId)}
                      selectable={selectablePlayIds.includes(unit.playId)}
                      customGlowClass={getUnitGlowClass(unit.playId)}
                      onClick={selectablePlayIds.includes(unit.playId) ? () => handleUnitClick(unit.playId) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      exhausted={!unit.ready}
                      damage={unit.damage}
                      compact
                      arenaScale60
                      sentinel={sentinelPlayIds.includes(unit.playId)}
                      buff={unitBuffs[unit.playId]}
                      square
                    />
                    {unit.upgrades.map((upgrade) => {
                      const isSelectable = selectableUpgradePlayIds.has(upgrade.playId);
                      return (
                        <UpgradeStrip
                          key={upgrade.playId}
                          cardId={upgrade.cardId}
                          playId={upgrade.playId}
                          selectable={isSelectable}
                          onClick={isSelectable ? () => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [upgrade.playId] })) : undefined}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      );
                    })}{(unit.captives ?? []).map((captive) => <CaptiveStrip key={captive.playId} cardId={captive.cardId} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />)}
                    {spreadEligiblePlayIds.has(unit.playId) && (
                      <div className="absolute left-0 right-0 top-[3.6rem] z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5">
                        <button type="button" onClick={() => handleSpreadDecrement(unit.playId)} disabled={(spreadDmgMap[unit.playId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
                        <span className={spreadValueClass}>{spreadDmgMap[unit.playId] ?? 0}</span>
                        <button type="button" onClick={() => handleSpreadIncrement(unit.playId)} disabled={isSpreadIncrementDisabled(unit.playId)} className={spreadBtnClass}>+</button>
                      </div>
                    )}
                  </div>)}
                </div>
              </div>

              <div className="rounded-lg bg-black/20 p-2">
                <div className="grid grid-cols-2 gap-2 xl:hidden">
                  {!player.leader.deployed ? <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={player.leader.cardId}
                    selectable={uiCanClickLeader}
                    onClick={uiCanClickLeader ? () => { if (LEADERS_WITH_ACTION_ABILITY.has(player.leader.cardId) && player.leader.ready) { setLeaderModalOpen(true); } else { handleLeaderDeploy(); } } : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!player.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                    epicUsed={player.leader.epicActionUsed}
                  /></div> : <div className="mx-auto w-full max-w-[140px] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader deployed to Ground Arena
                  </div>}
                  <div className="mx-auto w-full max-w-[140px]"><CardVisual
                    cardId={player.base.cardId}
                    selectable={uiCanClickBase || selectableBaseForPlayer.includes(1)}
                    onClick={uiCanClickBase || selectableBaseForPlayer.includes(1) ? () => handleBaseClick(1) : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                    centerDamageBadge={player.base.damage}
                    epicUsed={player.base.epicActionUsed}
                    forceToken={player.supplemental.forceToken}
                  />{spreadBaseControls("player1.base")}</div>
                </div>
                <div className="hidden xl:space-y-2 xl:block">
                  <div className="relative">
                    <CardVisual
                      cardId={player.base.cardId}
                      selectable={uiCanClickBase || selectableBaseForPlayer.includes(1)}
                      onClick={uiCanClickBase || selectableBaseForPlayer.includes(1) ? () => handleBaseClick(1) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      compact
                      cardScale90
                      centerDamageBadge={player.base.damage}
                      epicUsed={player.base.epicActionUsed}
                      forceToken={player.supplemental.forceToken}
                    />
                    {spreadBaseControls("player1.base")}
                  </div>
                  {!player.leader.deployed ? <CardVisual
                    cardId={player.leader.cardId}
                    selectable={uiCanClickLeader}
                    onClick={uiCanClickLeader ? () => { if (LEADERS_WITH_ACTION_ABILITY.has(player.leader.cardId) && player.leader.ready) { setLeaderModalOpen(true); } else { handleLeaderDeploy(); } } : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!player.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    cardScale90
                    epicUsed={player.leader.epicActionUsed}
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
                    const isLeader = CardIsLeader(unit.cardId);
                    return <div key={unit.playId} className="relative w-24 shrink-0">
                      <CardVisual
                        cardId={unit.cardId}
                        imageId={getPreviewImageId(unit.cardId, isLeader)}
                        selectable={selectablePlayIds.includes(unit.playId)}
                        customGlowClass={getUnitGlowClass(unit.playId)}
                        onClick={selectablePlayIds.includes(unit.playId) ? () => handleUnitClick(unit.playId) : undefined}
                        onPreviewStart={handlePreviewStart}
                        onPreviewEnd={handlePreviewEnd}
                        exhausted={!unit.ready}
                        damage={unit.damage}
                        compact
                        arenaScale60
                        sentinel={sentinelPlayIds.includes(unit.playId)}
                        buff={unitBuffs[unit.playId]}
                        square
                      />
                      {unit.upgrades.map((upgrade) => {
                      const isSelectable = selectableUpgradePlayIds.has(upgrade.playId);
                      return (
                        <UpgradeStrip
                          key={upgrade.playId}
                          cardId={upgrade.cardId}
                          playId={upgrade.playId}
                          selectable={isSelectable}
                          onClick={isSelectable ? () => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [upgrade.playId] })) : undefined}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      );
                    })}{(unit.captives ?? []).map((captive) => <CaptiveStrip key={captive.playId} cardId={captive.cardId} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />)}
                    {spreadEligiblePlayIds.has(unit.playId) && (
                      <div className="absolute left-0 right-0 top-[3.6rem] z-10 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5">
                        <button type="button" onClick={() => handleSpreadDecrement(unit.playId)} disabled={(spreadDmgMap[unit.playId] ?? 0) <= 0} className={spreadBtnClass}>−</button>
                        <span className={spreadValueClass}>{spreadDmgMap[unit.playId] ?? 0}</span>
                        <button type="button" onClick={() => handleSpreadIncrement(unit.playId)} disabled={isSpreadIncrementDisabled(unit.playId)} className={spreadBtnClass}>+</button>
                      </div>
                    )}
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
                  {player.resources.map((resource) => {
                    const isSmuggleable = smuggleablePlayIds.has(resource.playId);
                    return <div
                      key={resource.playId}
                      className={`relative ${isSmuggleable ? "cursor-pointer" : ""}`}
                      onClick={isSmuggleable ? () => { void sendDispatch(createDispatch("play-smuggle", { playId: resource.playId })); } : undefined}
                    >
                      <div className={!resource.ready ? "opacity-40" : ""}>
                        <FaceDownResource
                          cardId={resource.cardId}
                          exhausted={!resource.ready}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      </div>
                      {isSmuggleable && <div className={`pointer-events-none absolute inset-0 rounded-xl ${lightsaberGlow}`} />}
                    </div>;
                  })}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Deck</div>
                <StatCard label="Count" value={player.deck.length} />
              </div>
              <div className="rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Discard</div>
                {latestPlayerDiscard ? <button type="button" className={`w-24 text-left${hasDiscardSelection ? " ring-2 ring-sky-400/60 rounded" : ""}`} onClick={() => setDiscardModalPlayer(1)}>
                  <CardVisual
                    cardId={latestPlayerDiscard.cardId}
                    selectable={hasDiscardSelection}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                  />
                </button> : <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/40">Empty</div>}
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
                const handSelected = isMultiSelectHand && selectedTargetIndices.includes(index);
                const handGlow = handSelected
                  ? "ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.5)]"
                  : "shadow-[0_0_10px_rgba(var(--lightsaber-r),var(--lightsaber-g),var(--lightsaber-b),0.55)]";
                return <div key={`${card.cardId}-${index}`} className="relative w-[5rem] shrink-0 origin-bottom transition-transform duration-150 hover:z-30 hover:-translate-y-1 hover:scale-[1.3]">
                  <div className="xl:hidden">
                    <CardVisual
                      cardId={card.cardId}
                      selectable={selectable}
                      onClick={selectable ? () => handleHandClick(index, card.cardId) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      square
                      customGlowClass={handGlow}
                    />
                  </div>
                  <div className="hidden xl:block">
                    <CardVisual
                      cardId={card.cardId}
                      selectable={selectable}
                      onClick={selectable ? () => handleHandClick(index, card.cardId) : undefined}
                      onPreviewStart={handlePreviewStart}
                      onPreviewEnd={handlePreviewEnd}
                      handScaleHalf
                      customGlowClass={handGlow}
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

    {preview ? <div className="pointer-events-none fixed bottom-4 right-4 z-[60] hidden w-[27rem] rounded-lg border border-white/15 bg-black/85 p-2 shadow-2xl backdrop-blur-sm lg:block">
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

    {isMultiSelectTarget && discardModalPlayer === null ? <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-amber-400/30 bg-[rgba(8,12,26,0.97)] px-5 py-3 shadow-2xl">
      <span className="text-sm text-white/70">
        {isMultiSelectHand ? selectedTargetIndices.length : selectedTargetPlayIds.length} / {resolutionNeeded?.maxTargets ?? "?"} selected
      </span>
      <button type="button" disabled={isResolving} onClick={handleConfirmTargets}
        className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-40">
        Confirm ({isMultiSelectHand ? selectedTargetIndices.length : selectedTargetPlayIds.length})
      </button>
    </div> : null}

    {resolutionNeeded && !hasPrompt ? <div className={`fixed left-1/2 z-40 w-[min(90vw,42rem)] -translate-x-1/2 rounded-xl border border-white/15 bg-black/80 px-5 py-3 text-center text-sm text-white/90 shadow-2xl backdrop-blur-sm transition-all ${isMultiSelectTarget ? "bottom-20" : "bottom-5"}`}>
      {formatStatus(status, resolutionNeeded)}
    </div> : null}

    {resolutionNeeded?.type === "SpreadDamage" && (
      <div className={`fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-[rgba(8,12,26,0.97)] px-5 py-3 shadow-2xl ${isHealMode ? "border-sky-400/30" : "border-rose-400/30"}`}>
        <span className="text-sm text-white/70">
          {spreadAssigned} / {resolutionNeeded.totalDamage} {isHealMode ? "healed" : "dmg assigned"}
        </span>
        {!isHealMode && resolutionNeeded.optional && (
          <button type="button" onClick={() => handleSpreadConfirm([])}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20">
            Skip
          </button>
        )}
        <button type="button" disabled={!spreadCanConfirm}
          onClick={() => handleSpreadConfirm(Object.entries(spreadDmgMap).filter(([, v]) => v > 0).map(([playId, damage]) => ({ playId, damage })))}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${isHealMode ? "bg-sky-700 hover:bg-sky-600" : "bg-rose-700 hover:bg-rose-600"}`}>
          Confirm
        </button>
      </div>
    )}

    {hasPrompt ? <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`rounded-xl border border-white/20 bg-[rgba(8,12,26,0.97)] p-6 shadow-2xl${resolutionNeeded?.type === "DeckSearch" ? " w-[min(90vw,700px)]" : " w-[min(90vw,700px)]"}`}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
          {isNameCardPrompt ? "Name a Card" : resolutionNeeded?.type === "Trigger" ? "Choose a Trigger" : resolutionNeeded?.type === "Player" ? "Choose a Player" : resolutionNeeded?.type === "DeckSearch" && resolutionNeeded.action === "scry" ? "Look at the top cards" : resolutionNeeded?.type === "DeckSearch" ? "Deck Search" : "Choose"}
        </h3>
        {(resolutionNeeded?.type === "Option" || (resolutionNeeded?.type === "DeckSearch" && resolutionNeeded.action !== "scry"))
            ? <p className="-mt-2 mb-4 max-w-xs text-xs text-white/65">{resolutionNeeded.helperText}</p>
            : null}
        <div className="flex flex-col gap-3">
          {isNameCardPrompt && resolutionNeeded?.type === "Target" && resolutionNeeded.fromChoices ? (() => {
            const q = nameCardSearch.trim().toLowerCase();
            const filtered = q.length >= 1
              ? resolutionNeeded.fromChoices.filter(t => t.toLowerCase().includes(q)).slice(0, 50)
              : [];
            return (
              <>
                <p className="-mt-2 mb-1 max-w-xs text-xs text-white/65">
                  Opponents can&apos;t play that card while Regional Governor is in play.
                </p>
                <input
                  autoFocus
                  type="text"
                  placeholder="Type a card name…"
                  value={nameCardSearch}
                  onChange={e => setNameCardSearch(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/35 outline-none focus:border-sky-400/60 focus:bg-white/10"
                />
                {filtered.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/40">
                    {filtered.map(title => (
                      <button
                        key={title}
                        type="button"
                        disabled={isResolving}
                        onClick={() => {
                          void sendDispatch(createDispatch("choose-target", { targetPlayIds: [title] }));
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-white/85 transition hover:bg-sky-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                )}
                {q.length >= 1 && filtered.length === 0 && (
                  <p className="text-center text-xs text-white/40">No cards match &ldquo;{nameCardSearch}&rdquo;</p>
                )}
              </>
            );
          })() : resolutionNeeded?.type === "Option" ? resolutionNeeded.options.map((opt) => {
            const displayLabel = opt === "Yes" && resolutionNeeded.yesLabel
              ? resolutionNeeded.yesLabel
              : opt === "No" && resolutionNeeded.noLabel
              ? resolutionNeeded.noLabel
              : formatOptionLabel(opt);
            return (
              <button key={opt} type="button" disabled={isResolving}
                onClick={() => handleOptionChoice(opt)}
                className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-40">
                {displayLabel}
              </button>
            );
          }) : resolutionNeeded?.type === "Trigger" ? resolutionNeeded.fromCardIds.map((id) => (
            <button key={id} type="button" disabled={isResolving}
              onClick={() => handleTriggerChoice(id)}
              className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-40">
              {CardTitle(id)}
            </button>
          )) : resolutionNeeded?.type === "Player" ? resolutionNeeded.fromPlayers.map((p) => (
            <button key={p} type="button" disabled={isResolving}
              onClick={() => handlePlayerChoice(p)}
              className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-40">
              {p === 1 ? "Player" : "Opponent"}
            </button>
          )) : resolutionNeeded?.type === "DeckSearch" && resolutionNeeded.action === "scry" ? (
            <>
              <div className="flex gap-4 justify-center mb-3 flex-wrap">
                {resolutionNeeded.choices.map((c) => {
                  const topPos = scryTopOrder.indexOf(c.tempId);
                  const isTop = topPos !== -1;
                  const isBottom = scryBottomSet.has(c.tempId);
                  return (
                    <div key={c.tempId} className="flex flex-col items-center gap-2">
                      <div className="w-[5rem]">
                        <CardVisual
                          cardId={c.cardId}
                          selectable={false}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                          compact
                        />
                      </div>
                      <div className="flex gap-1">
                        <button type="button" disabled={isResolving}
                          onClick={() => handleScryTop(c.tempId)}
                          className={`rounded px-2 py-1 text-xs font-semibold transition ${isTop ? "border border-sky-400/80 bg-sky-500/30 text-sky-200" : "border border-white/15 bg-white/10 text-white/60 hover:bg-white/20"}`}>
                          {isTop ? `Top ${topPos + 1}` : "Top"}
                        </button>
                        <button type="button" disabled={isResolving}
                          onClick={() => handleScryBottom(c.tempId)}
                          className={`rounded px-2 py-1 text-xs font-semibold transition ${isBottom ? "border border-rose-400/80 bg-rose-500/30 text-rose-200" : "border border-white/15 bg-white/10 text-white/60 hover:bg-white/20"}`}>
                          Bottom
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" disabled={isResolving || resolutionNeeded.choices.some(c => !scryTopOrder.includes(c.tempId) && !scryBottomSet.has(c.tempId))}
                onClick={handleScryConfirm}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-40">
                Confirm
              </button>
            </>
          ) : resolutionNeeded?.type === "DeckSearch" ? (
            <>
              <div className="flex flex-wrap gap-3 justify-center mb-1">
                {resolutionNeeded.choices.map((c) => {
                  const selected = deckSearchSelected.has(c.tempId);
                  const atMaxChoices = !selected && resolutionNeeded.maxChoices != null && deckSearchSelected.size >= resolutionNeeded.maxChoices;
                  const wouldExceed = !selected && resolutionNeeded.maxCombinedCost != null && deckSearchCost + c.cost > resolutionNeeded.maxCombinedCost;
                  const disabled = isResolving || atMaxChoices || wouldExceed;
                  return (
                    <button key={c.tempId} type="button" disabled={disabled}
                      onClick={() => setDeckSearchSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(c.tempId)) next.delete(c.tempId); else next.add(c.tempId);
                        return next;
                      })}
                      className={`w-[5rem] text-left transition${disabled && !selected ? " opacity-40 cursor-not-allowed" : ""}`}>
                      <CardVisual
                        cardId={c.cardId}
                        selectable={!disabled && !isResolving}
                        customGlowClass={selected ? "ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.5)]" : undefined}
                        onPreviewStart={handlePreviewStart}
                        onPreviewEnd={handlePreviewEnd}
                        compact
                      />
                    </button>
                  );
                })}
              </div>
              {resolutionNeeded.action === "play" && resolutionNeeded.maxCombinedCost != null
                ? <div className="text-center text-xs text-white/45">Total cost: {deckSearchCost} / {resolutionNeeded.maxCombinedCost}</div>
                : null}
              <button type="button" disabled={isResolving} onClick={handleDeckSearchConfirm}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-40">
                {deckSearchSelected.size === 0
                  ? "Take Nothing"
                  : resolutionNeeded.action === "draw"
                    ? `Draw ${deckSearchSelected.size} Card${deckSearchSelected.size > 1 ? "s" : ""}`
                    : `Play ${deckSearchSelected.size} Unit${deckSearchSelected.size > 1 ? "s" : ""} for Free`}
              </button>
            </>
          ) : resolutionNeeded?.type === "PeekHand" ? (
            <>
              <p className="-mt-2 mb-3 text-xs text-white/60">
                {resolutionNeeded.mustDiscard ? "Choose a card to discard." : "Opponent's hand — no action required."}
              </p>
              <div className="flex flex-wrap gap-3 justify-center mb-3">
                {(resolutionNeeded.targetPlayer === 2 ? opponent : player).hand.map((card, i) => {
                  const eligible = resolutionNeeded.eligibleIndices.includes(i);
                  return (
                    <button key={i} type="button"
                      disabled={isResolving || !resolutionNeeded.mustDiscard || !eligible}
                      onClick={() => resolutionNeeded.mustDiscard && eligible
                        ? void sendDispatch(createDispatch("choose-target", { targetIndices: [i] }))
                        : undefined}
                      className={`w-[5rem] text-left transition${resolutionNeeded.mustDiscard && eligible ? "" : " opacity-60 cursor-default"}`}
                      onMouseEnter={() => handlePreviewStart({ imageId: card.cardId, cardId: card.cardId, label: CardTitle(card.cardId) })}
                      onMouseLeave={handlePreviewEnd}>
                      <CardVisual
                        cardId={card.cardId}
                        selectable={resolutionNeeded.mustDiscard && eligible}
                        onPreviewStart={handlePreviewStart}
                        onPreviewEnd={handlePreviewEnd}
                        compact
                      />
                    </button>
                  );
                })}
              </div>
              {!resolutionNeeded.mustDiscard ? (
                <button type="button" disabled={isResolving}
                  onClick={() => void sendDispatch(createDispatch("choose-target", { targetIndices: [] }))}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
                  Got it
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div> : null}

    {discardModalPlayer !== null ? (() => {
      const discardCards = discardModalPlayer === 1 ? player.discard : opponent.discard;
      const ownerLabel = discardModalPlayer === 1 ? "Your" : "Opponent's";
      return <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDiscardModalPlayer(null)}>
        <div className="max-h-[80vh] w-[min(90vw,640px)] overflow-y-auto rounded-xl border border-white/20 bg-[rgba(8,12,26,0.97)] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">{ownerLabel} Discard ({discardCards.length})</h3>
            <button type="button" onClick={() => setDiscardModalPlayer(null)} className="text-white/40 hover:text-white/80 text-lg leading-none">✕</button>
          </div>
          {discardCards.length === 0
            ? <div className="py-8 text-center text-sm text-white/40">Empty</div>
            : <div className="flex flex-wrap gap-2 justify-start">
              {discardCards.map(d => {
                const isSelectable = selectableDiscardPlayIds.has(d.playId);
                const isSelected = selectedTargetPlayIds.includes(d.playId);
                return <button
                  key={d.playId}
                  type="button"
                  disabled={isResolving || (!isSelectable && selectableDiscardPlayIds.size > 0)}
                  onClick={() => {
                    if (!isSelectable) return;
                    if (isMultiSelectTarget) {
                      setSelectedTargetPlayIds(prev =>
                        prev.includes(d.playId)
                          ? prev.filter(id => id !== d.playId)
                          : prev.length < (resolutionNeeded?.type === "Target" ? (resolutionNeeded.maxTargets ?? Infinity) : Infinity)
                            ? [...prev, d.playId]
                            : prev
                      );
                    } else {
                      setDiscardModalPlayer(null);
                      void sendDispatch(createDispatch("choose-target", { targetPlayIds: [d.playId] }));
                    }
                  }}
                  className={`w-24 text-left${!isSelectable && selectableDiscardPlayIds.size > 0 ? " opacity-40" : ""}`}
                  onMouseEnter={() => handlePreviewStart({ imageId: d.cardId, cardId: d.cardId, label: CardTitle(d.cardId) })}
                  onMouseLeave={handlePreviewEnd}
                >
                  <CardVisual
                    cardId={d.cardId}
                    selectable={isSelectable && !isResolving}
                    customGlowClass={isSelected ? "ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.5)]" : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    compact
                    square
                  />
                </button>;
              })}
            </div>
          }
          {isMultiSelectTarget && selectableDiscardPlayIds.size > 0 && (
            <button
              type="button"
              // Discard-return prompts are all "up to N" / "may return" — selecting 0 is legal.
              disabled={isResolving}
              onClick={() => {
                setDiscardModalPlayer(null);
                void sendDispatch(createDispatch("choose-target", { targetPlayIds: selectedTargetPlayIds }));
              }}
              className="mt-4 w-full rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm ({selectedTargetPlayIds.length} / {resolutionNeeded?.type === "Target" ? (resolutionNeeded.maxTargets ?? "?") : "?"})
            </button>
          )}
        </div>
      </div>;
    })() : null}

    {showInfoModal && puzzleMeta ? <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowInfoModal(false)}>
      <div className="w-[min(90vw,720px)] rounded-xl border border-sky-400/30 bg-[rgba(8,12,26,0.94)] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 border-b border-white/10 pb-4">
          <h3 className="text-lg font-black uppercase tracking-[0.2em] text-white">{puzzleMeta.name || puzzleName}</h3>
          {puzzleMeta.author ? <p className="mt-1 text-xs text-white/50">By {puzzleMeta.author}{puzzleMeta.inspiredBy ? <span className="ml-2 text-white/35">· Inspired by {puzzleMeta.inspiredBy}</span> : null}</p> : null}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-white/85">{puzzleMeta.infoText}</p>
        <button type="button" onClick={() => setShowInfoModal(false)} className="mt-6 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20">
          Got it
        </button>
      </div>
    </div> : null}

    {showSolutionModal && puzzleMeta ? <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowSolutionModal(false)}>
      <div className="w-[min(90vw,1080px)] rounded-xl border border-emerald-400/30 bg-[rgba(8,12,26,0.92)] p-12 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-bold text-emerald-300">Congratulations! You&apos;ve solved the puzzle!</h3>
        <div className="mb-4 border-b border-white/10 pb-4">
          <p className="text-sm font-semibold text-white">{puzzleMeta.name || puzzleName}</p>
          {puzzleMeta.author ? <p className="mt-0.5 text-xs text-white/50">By {puzzleMeta.author}</p> : null}
          {puzzleMeta.inspiredBy ? <p className="mt-0.5 text-xs text-white/40">Inspired by {puzzleMeta.inspiredBy}</p> : null}
        </div>
        {puzzleMeta.intendedSolution.length > 0 ? <>
          <p className="mb-3 text-sm text-white/60">Here&apos;s the author&apos;s intended solution:</p>
          <ul className="mb-5 space-y-2">
            {puzzleMeta.intendedSolution.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/90">
                <img src="/assets/puzzle.svg" alt="" className="mt-1.25 h-2.5 w-2.5 shrink-0 brightness-0 invert" />
                <span><CardLinkText text={step} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} /></span>
              </li>
            ))}
          </ul>
        </> : null}
        <p className="mb-4 text-xs text-white/50">If your solution was different, feel free to let us know on our <a href="https://discord.gg/swuniversity" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300">Discord</a>!</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowSolutionModal(false)} className="flex-1 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/20">
            Close
          </button>
          <button type="button" onClick={() => { setShowSolutionModal(false); setGameState(null); setPuzzleName(null); setPuzzleMeta(null); setShowInfoModal(false); setActionError(null); }} className="flex-1 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500/25">
            Puzzle Home
          </button>
        </div>
      </div>
    </div> : null}

    {showHintsModal && (puzzleMeta?.hints?.length ?? 0) > 0 ? <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowHintsModal(false)}>
      <div className="w-[min(90vw,640px)] max-h-[80vh] overflow-y-auto rounded-xl border border-amber-400/30 bg-[rgba(8,12,26,0.94)] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 border-b border-white/10 pb-4">
          <h3 className="text-lg font-black uppercase tracking-[0.2em] text-white">Hints</h3>
          <p className="mt-1 text-xs text-white/45">Open only as many as you need.</p>
        </div>
        <div className="space-y-2">
          {(puzzleMeta?.hints ?? []).map((hint, i) => {
            const isOpen = openHints.has(i);
            return (
              <div key={i} className="rounded-lg border border-white/10 bg-black/20">
                <button
                  type="button"
                  onClick={() => setOpenHints(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-white/90 hover:bg-white/5"
                >
                  <span>Hint {i + 1}</span>
                  <span className="text-white/40">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen ? (
                  <p className="whitespace-pre-wrap border-t border-white/10 px-4 py-3 text-sm leading-6 text-white/80">
                    <CardLinkText text={hint} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setShowHintsModal(false)} className="mt-6 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20">
          Close
        </button>
      </div>
    </div> : null}

    {showFailModal ? <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowFailModal(false)}>
      <div className="w-[min(90vw,560px)] rounded-xl border border-rose-400/40 bg-[rgba(8,12,26,0.94)] p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-2 text-base font-bold text-rose-300">Puzzle failed</h3>
        <p className="mb-6 text-sm text-white/70">Your base was defeated. Reset to try again, or head back to the puzzles menu.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowFailModal(false); if (selectedPuzzleFilename !== null) void loadPuzzle(selectedPuzzleFilename); }}
            className="flex-1 rounded-lg border border-white/15 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500/30"
          >
            Reset Puzzle
          </button>
          <button
            type="button"
            onClick={() => { setShowFailModal(false); setGameState(null); setPuzzleName(null); setPuzzleMeta(null); setShowInfoModal(false); setActionError(null); }}
            className="flex-1 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20"
          >
            Return to Puzzles Menu
          </button>
        </div>
      </div>
    </div> : null}

    {leaderModalOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="rounded-xl border border-white/20 bg-[rgba(8,12,26,0.97)] p-6 shadow-2xl">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Leader Action</h3>
        <div className="flex flex-col gap-3">
          {gameState.player1.leader.ready ? (
          <button type="button" onClick={handleLeaderAbility}
            className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/35">
            Use Leader Ability
          </button>
          ) : null}
          {!gameState.player1.leader.epicActionUsed ? (
            <button type="button" onClick={handleLeaderDeploy}
              className="rounded-lg border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500/35">
              Deploy Leader
            </button>
          ) : null}
          <button type="button" onClick={() => setLeaderModalOpen(false)}
            className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/20">
            Cancel
          </button>
        </div>
      </div>
    </div> : null}

    {unitAbilityModal ? <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="rounded-xl border border-white/20 bg-[rgba(8,12,26,0.97)] p-6 shadow-2xl">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Unit Action</h3>
        <p className="mb-4 text-xs text-white/50">{CardTitle(unitAbilityModal.cardId)}</p>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={handleUnitAttack}
            className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500/35">
            Attack
          </button>
          <button type="button" onClick={handleUnitAbility}
            className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/35">
            Action: {UNITS_WITH_ACTION_ABILITY[unitAbilityModal.cardId]}
          </button>
          <button type="button" onClick={() => setUnitAbilityModal(null)}
            className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/20">
            Cancel
          </button>
        </div>
      </div>
    </div> : null}

    {hasPlotPrompt && resolutionNeeded?.type === "Plot" ? <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="rounded-xl border border-amber-400/30 bg-[rgba(8,12,26,0.97)] p-6 shadow-2xl">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">Plot</h3>
        <p className="mb-4 text-xs text-white/60">Choose a Plot card to play from your resources, or pass.</p>
        <div className="mb-4 flex flex-wrap gap-3 justify-center">
          {resolutionNeeded.fromPlayIds.map((playId) => {
            const resource = player.resources.find(r => r.playId === playId);
            if (!resource) return null;
            return <button
              key={playId}
              type="button"
              disabled={isResolving}
              onClick={() => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [playId] }))}
              className="w-28 text-left"
              onMouseEnter={() => handlePreviewStart({ imageId: resource.cardId, cardId: resource.cardId, label: CardTitle(resource.cardId) })}
              onMouseLeave={handlePreviewEnd}
            >
              <CardVisual
                cardId={resource.cardId}
                selectable={!isResolving}
                onPreviewStart={handlePreviewStart}
                onPreviewEnd={handlePreviewEnd}
                compact
              />
            </button>;
          })}
        </div>
        <button
          type="button"
          disabled={isResolving}
          onClick={() => void sendDispatch(createDispatch("choose-target", { targetPlayIds: [] }))}
          className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Pass (skip Plot)
        </button>
      </div>
    </div> : null}

    <div className="mt-4 space-y-3 xl:hidden">
      <SectionShell title="Actions" className="rounded-lg p-3">
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {puzzleMeta?.infoText && puzzleMeta.infoText.trim() ? (
            <button type="button" onClick={() => setShowInfoModal(true)} className="rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-sky-500/25">Puzzle Info</button>
          ) : null}
          <button type="button" onClick={() => void handleUndo()} disabled={isResolving || historyLength === 0} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
          <button type="button" onClick={handlePass} disabled={isResolving || isGameOver || !!resolutionNeeded} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Pass to Regroup Draw</button>
          <button type="button" onClick={handleClaimInitiative} disabled={isResolving || gameState.initiativeClaimed || isGameOver || !!resolutionNeeded} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Take Initiative</button>
          {(puzzleMeta?.hints?.length ?? 0) > 0 ? (
            <button type="button" onClick={() => setShowHintsModal(true)} className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-amber-500/25">Hints</button>
          ) : null}
          <div className="hidden sm:block h-3" />
          <button type="button" onClick={() => { if (selectedPuzzleFilename !== null) void loadPuzzle(selectedPuzzleFilename); }} disabled={isResolving || selectedPuzzleFilename === null} className="rounded-xl border border-white/15 bg-rose-500/20 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40">Reset Puzzle</button>
        </div>
        <div className={`mt-1 text-xs ${lastActionMs !== null && lastActionMs > 600 ? "text-amber-200" : "text-white/55"}`}>
          {isResolving ? "Resolving..." : lastActionMs !== null ? `Last action ${lastActionMs} ms` : "Last action --"}
        </div>
      </SectionShell>
      <SectionShell title="Initiative" className="rounded-lg p-3">
        <div className="mt-2 rounded-lg bg-black/25 px-3 py-2 text-xs text-white/75">
          {gameState.initiativePlayer === 1 ? "Player" : "Enemy"}
        </div>
      </SectionShell>
      <SectionShell title="Status" className="rounded-lg p-3">
        <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${statusTone}`}>
          <div>{formatStatus(status, resolutionNeeded)}</div>
          {actionError ? <div className="mt-1 text-xs text-rose-200">{actionError}</div> : null}
        </div>
      </SectionShell>
    </div>
  </div>;
}

export default PuzzlesPage;
