import React from "react";
import { CardSubtitle, CardTitle } from "@/server/engine/card-db/generated";
import { getCardImageLink, getCardSquareImageLink, getSWUDBImageLink, getSWUDBImageLinkFallback } from "@/util/func";
import { DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";
import { getMasteredIds } from "@/util/profile-api";
import { globalBackgroundStyle, lightsaberGlow } from "@/util/style-const";
import { DiscordLink } from "@/util/const";
import { LoadPuzzlePanel } from "@/components/Shared/LoadPuzzlePanel";
import type { PuzzleAccessLevel } from "@/server/puzzle/puzzle-status";
import { PuzzleBuilderPanel } from "@/components/Shared/PuzzleBuilderPanel";
import { DEFAULT_ALTERNATE_FAIL_EXPLANATION } from "@/components/Shared/puzzle-builder-state";
import { CardLinkText, PuzzleText } from "@/components/Shared/CardLink";
import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import type { DispatchResponse, DispatchType, DispatchData, GameDispatch, ResolutionRequest } from "@/lib/engine/message-types";
import type { EngineContext } from "@/server/engine/pending-resolution";
import { CardIsLeader, LeaderHasUnitSide } from "@/server/engine/core-functions";
import { CardIsPlayable, ResourceIsSmuggleable } from "@/server/engine/card-playability";

type PreviewState = {
  imageId: string;
  cardId: string;
  label?: string;
};

/**
 * How a preview was requested. Hover previews fade in after a delay and vanish on mouse-out;
 * a `sticky` one (long-press) opens immediately and stays until the player dismisses it, which
 * is the only way to read a card on a touch device — there is no hover there, and the hover
 * panel is desktop-only anyway.
 */
type PreviewOpts = { sticky?: boolean };
type PreviewStart = (preview: PreviewState, opts?: PreviewOpts) => void;

/** Movement (px) past which a touch counts as a scroll rather than a press-and-hold. */
const LONG_PRESS_SLOP = 10;
const LONG_PRESS_MS = 450;

/**
 * Touch handlers that fire `open` on a press-and-hold, and swallow the click that would
 * otherwise follow — without this, holding a selectable card to read it would also target it.
 *
 * Spread onto the same element that carries the hover handlers. That element sits INSIDE the
 * selectable <button>, so its capture-phase click handler runs before the button's onClick and
 * can cancel it.
 */
function useLongPress(open: () => void) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  // Survives the touchend→click gap so the click that follows a hold can be identified.
  const fired = React.useRef(false);

  const cancel = React.useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    start.current = null;
  }, []);
  React.useEffect(() => cancel, [cancel]);

  const props = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      fired.current = false;
      start.current = { x: t.clientX, y: t.clientY };
      timer.current = setTimeout(() => { fired.current = true; timer.current = null; open(); }, LONG_PRESS_MS);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t || !start.current) return;
      if (Math.abs(t.clientX - start.current.x) > LONG_PRESS_SLOP
        || Math.abs(t.clientY - start.current.y) > LONG_PRESS_SLOP) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    // Stops the click reaching any ANCESTOR handler (the selectable <button> wrapper). Runs
    // before any bubble-phase onClick, including `guard`'s — which is what clears the flag when
    // the handler lives on this same element.
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      e.preventDefault();
      e.stopPropagation();
      // Nothing downstream will clear it on the ancestor path, and a stale flag would eat the
      // next ordinary click.
      setTimeout(() => { fired.current = false; }, 0);
    },
    // Suppress the iOS press-and-hold callout ("Save Image…") over card art.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: { WebkitTouchCallout: "none" } as React.CSSProperties,
  };

  /**
   * Wraps a click handler living on the SAME element as these props. stopPropagation only stops
   * other nodes, so a same-element onClick would still run after a hold — this drops it.
   */
  const guard = <T,>(handler: ((arg: T) => void) | undefined) =>
    handler
      ? (arg: T) => {
          if (fired.current) { fired.current = false; return; }
          handler(arg);
        }
      : undefined;

  return { props, guard };
}

function getPreviewImageId(cardId: string, showBack = false): string {
  return showBack ? `${cardId}_BACK` : cardId;
}

/**
 * The art for the face a leader is currently showing. A double-sided leader (TWI_017) flips to
 * its BACK image — for Flipatine that really is a different character, Darth Sidious.
 */
function leaderFaceImageId(leader: { cardId: string; flipped?: boolean }): string {
  return getPreviewImageId(leader.cardId, leader.flipped === true);
}

/** One face to show in a preview, and whether its art is landscape. */
type PreviewFace = { imageId: string; landscape: boolean };

/**
 * The faces a preview shows. A leader always previews as BOTH sides, whichever one the player
 * happened to hover — the leader in its zone, the deployed leader unit in an arena, the leader
 * attached as a Pilot upgrade, and `@[ID-L]` links in puzzle text all land here.
 *
 * Orientation cannot be read from the id: `isHorizontalCard` treats every `_BACK` as portrait,
 * which is right for a deployed unit side but wrong for a double-sided leader, whose back is
 * another landscape leader face (TWI_017 → Darth Sidious). `LeaderHasUnitSide` is the real signal.
 */
function previewFaces(cardId: string): PreviewFace[] {
  if (!CardIsLeader(cardId)) return [{ imageId: cardId, landscape: false }];
  return [
    { imageId: cardId, landscape: true },
    { imageId: `${cardId}_BACK`, landscape: !LeaderHasUnitSide(cardId) },
  ];
}

/**
 * A single preview face, owning its own art fallback chain (generated art → swudb import → swudb
 * CDN → card back) exactly as the board tiles do.
 *
 * The chain lives per-image rather than in the parent because a leader shows two faces at once,
 * and one shared "current src" in the parent could only ever track one of them.
 */
function PreviewImage({ imageId, alt, className }: { imageId: string; alt: string; className?: string }) {
  const chain = React.useMemo(() => [
    getCardImageLink(imageId),
    getSWUDBImageLink(imageId),
    getSWUDBImageLinkFallback(imageId),
    `/assets/${DEFAULT_PUZZLE_IMAGE}`,
  ], [imageId]);
  const [stage, setStage] = React.useState(0);
  React.useEffect(() => { setStage(0); }, [chain]);

  return (
    <img
      src={chain[Math.min(stage, chain.length - 1)]}
      alt={alt}
      className={className}
      onError={() => setStage(s => Math.min(s + 1, chain.length - 1))}
    />
  );
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

type GameStatus = "playing" | "won" | "lost" | "draw" | "failed-regroup";

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
  // Puzzle mode is a single action phase: reaching the "Choose a resource" step means the player
  // passed without winning, and the opponent would take the next turn. Deliberately checked AFTER
  // the defeat cases — the empty-deck draw damage (2 draws x 3 = 6) is applied inside
  // executeRegroupDraw BEFORE it sets this phase, so a lethal draw is already "lost" here and the
  // two never race. This branch is only reached by a player who SURVIVED their regroup draw.
  if (gameState.gamePhase === "RegroupResource") return "failed-regroup";
  return "playing";
}

function formatStatus(status: GameStatus, resolutionNeeded: ResolutionRequest | null): string {
  if (status === "won") return "Puzzle complete!";
  if (status === "lost") return "Puzzle failed.";
  if (status === "failed-regroup") return "Puzzle failed.";
  if (status === "draw") return "Puzzle ended in a draw.";
  if (resolutionNeeded?.type === "SpreadDamage") {
    return `Distribute ${resolutionNeeded.totalDamage} damage${resolutionNeeded.optional ? " (optional)" : ""}.`;
  }
  if (resolutionNeeded?.type === "Option") return resolutionNeeded.helperText;
  if (resolutionNeeded?.type === "Target") {
    if (resolutionNeeded.helperText) return resolutionNeeded.helperText;
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
  "TWI_002", "TWI_004", "TWI_005", "TWI_006", "TWI_007", "TWI_011", "TWI_012", "TWI_013", "TWI_014",
  "TWI_017", // Chancellor Palpatine // Darth Sidious — an Action on BOTH faces
  //Jump to Lightspeed
  "JTL_004", "JTL_005", "JTL_006", "JTL_008", "JTL_010", "JTL_012", "JTL_013", "JTL_014", "JTL_018",
  //Legends of the Underworld
  "LAW_002", "LAW_003", "LAW_008", "LAW_010", "LAW_011", "LAW_013", "LAW_015",
  //Legacy of the Force
  "LOF_002", "LOF_003", "LOF_004", "LOF_005", "LOF_007", "LOF_009", "LOF_011", "LOF_012", "LOF_013",
  "LOF_014", "LOF_015", "LOF_016", "LOF_018",
  //Secrets of Power
  "SEC_004", "SEC_005", "SEC_006", "SEC_007", "SEC_011", "SEC_015",
  //ASH
  "ASH_004", "ASH_009",
  //IBH
  "IBH_053", "IBH_001",
]);

// Non-leader units with an Action ability. Maps cardId → the modal button(s).
// Mirrors the playId block of ActionAbilities() in action-ability.ts.
//
// A unit with a SINGLE Action maps to one label and dispatches its bare cardId. A unit with more
// than one maps to a list; each entry carries the suffixed ability id (`SHD_087-1`) that
// ActionAbilities()/ActionAbilityCost() key off, so the engine knows which Action was chosen.
type UnitAction = { abilityId: string; label: string };
const UNITS_WITH_ACTION_ABILITY: Record<string, string | UnitAction[]> = {
  "SHD_028": "Draw a card",
  "LOF_206": "Attack with a Droid",
  "ASH_109": "+2/+2 to a unit",
  "ASH_142": "1 dmg to up to 3 ground units",
  "LOF_094": "Use the Force: play a unit for 2 less", // Jedi Consular
  "LOF_246": "Heal up to 2, deal that much", // Grogu
  "SHD_080": "Return to hand, 1 dmg to a ground unit", // Salacious Crumb
  "SHD_087": [ // Crosshair — two Actions
    { abilityId: "SHD_087-1", label: "2 resources: +1/+0 this phase" },
    { abilityId: "SHD_087-2", label: "Exhaust: deal his power to an enemy ground unit" },
  ],
  "LOF_134": "2 dmg to a ground unit", // Heavy Missile Gunship
  "IBH_016": "3 dmg to a space unit", // Ion Cannon
  "IBH_027": "3 dmg to a space unit",
  "IBH_023": "Attack w/ another Heroism unit (+2/+0)", // General Rieekan
  "IBH_036": "Attack w/ another Heroism unit (+2/+0)",
  "IBH_062": "Heal 2 from a Villainy unit", // Imperial Deck Officer
  "IBH_100": "Heal 2 from a Villainy unit",
  // Deployed leaders are units in the arena, so their Action button comes from this list too.
  "LAW_015": "Play an Underworld unit", // Jabba the Hutt (Crime Boss), deployed
};

/** The Action buttons to render for a unit, normalising the single- and multi-Action shapes. */
function unitActionsFor(cardId: string): UnitAction[] {
  const entry = UNITS_WITH_ACTION_ABILITY[cardId];
  if (!entry) return [];
  return typeof entry === "string" ? [{ abilityId: cardId, label: entry }] : entry;
}

const BASES_WITH_EPIC_ACTION = new Set([
  "SOR_022", "SOR_025", "SOR_028",
  // LAW "splash" bases — play a card from hand ignoring 1 non-side aspect penalty.
  "LAW_020", "LAW_021", "LAW_022", "LAW_024",
  "LAW_025", "LAW_027", "LAW_028", "LAW_030",
]);

/**
 * Bases whose ability is a plain repeatable "Action:" with a per-game cap, not a once-only Epic
 * Action. `epicActionUsed` says nothing about them, so the engine owns the remaining-use count and
 * simply rejects the dispatch once it runs out — the button stays clickable until then.
 * Mirrors BASE_LIMITED_ACTION_USES in dispatch-listener.ts.
 */
const BASES_WITH_LIMITED_ACTION = new Set([
  "LOF_022", // Mystic Monastery — "The Force is with you", 3 times each game
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
  abilitiesBlanked = false,
  buff,
}: {
  cardId: string;
  imageId?: string;
  selectable: boolean;
  onClick?: () => void;
  onPreviewStart: PreviewStart;
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
  /** Abilities blanked (Kazuda Xiono, Force Lightning, Mind Trick…) — shows the grey X. */
  abilitiesBlanked?: boolean;
  buff?: { power: number; hp: number };
}) {
  const pattern = imageId ?? cardId;
  // Same fallback chain StaticBoard uses: generated art -> swudb import -> swudb CDN -> card back.
  // Stopping at the local sources left cards with no generated art (LAW_187, the LAW_T01 Credit
  // token) rendering as bare alt text, which reads as a wall of words where a card should be.
  const imageChain = React.useMemo(() => {
    const chain = square
      ? [getCardSquareImageLink(pattern), getCardImageLink(pattern)]
      : [getCardImageLink(pattern), getSWUDBImageLink(pattern)];
    return [...chain, getSWUDBImageLinkFallback(pattern), `/assets/${DEFAULT_PUZZLE_IMAGE}`];
  }, [pattern, square]);
  const [imageStage, setImageStage] = React.useState(0);
  const imageSrc = imageChain[Math.min(imageStage, imageChain.length - 1)];
  const title = CardTitle(cardId);
  const subtitle = CardSubtitle(cardId);
  const previewState: PreviewState = { imageId: imageId ?? cardId, cardId, label: subtitle ? `${title} — ${subtitle}` : title };
  const hold = useLongPress(() => onPreviewStart(previewState, { sticky: true }));

  // Restart the chain whenever the card being shown changes.
  React.useEffect(() => {
    setImageStage(0);
  }, [imageChain]);
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
        {...hold.props}
        style={cardScale90 ? { ...hold.props.style, width: "90%", marginInline: "auto" } : hold.props.style}
        onMouseEnter={() => onPreviewStart(previewState)}
        onMouseLeave={onPreviewEnd}
      >
        <div className={`relative transition-transform duration-200 ${exhausted && rotateWhenExhausted ? "rotate-90" : ""}`}>
          <img
            src={imageSrc}
            alt={title}
            className={`w-full object-cover ${imageClass}`}
            onError={() => setImageStage(s => Math.min(s + 1, imageChain.length - 1))}
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
        {/* A net debuff reads red, a net buff blue — a "–3 / –3" in buff-blue would be misread at
            a glance. Each half keeps its own sign, so a mixed +2/–1 still shows honestly. */}
        {buff ? <div className="pointer-events-none absolute top-4 inset-x-0 flex items-center justify-center">
          <span className={`inline-flex w-[95%] items-center justify-center gap-2.5 rounded border py-0.5 text-[0.6rem] font-black leading-none text-white ${
            buff.power + buff.hp < 0
              ? "border-rose-300/30 bg-rose-600/70 shadow-[0_0_8px_rgba(244,63,94,0.45)]"
              : "border-sky-300/30 bg-sky-500/60 shadow-[0_0_8px_rgba(14,165,233,0.4)]"
          }`}>
            <span>{buff.power >= 0 ? "+" : "–"}{Math.abs(buff.power)}</span>
            <span>/</span>
            <span>{buff.hp >= 0 ? "+" : "–"}{Math.abs(buff.hp)}</span>
          </span>
        </div> : null}
      </div>
      {sentinel ? <div className="pointer-events-none absolute top-0 right-0 z-10">
        <img src="/assets/tokens/sentinel.png" alt="Sentinel" className="h-[1.8125rem] w-[1.8125rem]" />
      </div> : null}
      {/* Abilities blanked. Drawn as an SVG rather than an image asset so it stays crisp at any
          arena scale. Shares the top-right corner with Sentinel and the Force token, so a unit
          carrying either of those will show them stacked. */}
      {abilitiesBlanked ? <div
        className="pointer-events-none absolute top-0 right-0 z-10 opacity-70"
        title="Abilities blanked"
      >
        <svg
          viewBox="0 0 24 24"
          aria-label="Abilities blanked"
          role="img"
          className="h-[1.8125rem] w-[1.8125rem] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        >
          {/* A dark disc behind the strokes keeps the X readable over pale card art. */}
          <circle cx="12" cy="12" r="11" className="fill-black/60" />
          <path
            d="M7.5 7.5 L16.5 16.5 M16.5 7.5 L7.5 16.5"
            className="stroke-neutral-300"
            strokeWidth={2.75}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div> : null}
      {epicUsed ? <div className="pointer-events-none absolute -bottom-1 right-1.5 z-10">
        <img src="/assets/tokens/epic-used.png" alt="Epic action used" className="h-[2.5rem] w-[2.5rem] rotate-90" />
      </div> : null}
      {forceToken ? <div className="pointer-events-none absolute -top-1 right-1.5 z-10">
        <img src="/assets/force-token.webp" alt="The Force" title="Has the Force" className="h-[2.75rem] w-[2.75rem] drop-shadow-[0_0_4px_rgba(124,58,237,0.85)]" />
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
  onPreviewStart?: PreviewStart;
  onPreviewEnd?: () => void;
  onClick?: () => void;
}) {
  // Resources show only a card back, so press-and-hold is the ONLY way to find out what a
  // resource actually is on a touch device.
  const previewState: PreviewState = { imageId: cardId, cardId, label: CardTitle(cardId) };
  const hold = useLongPress(() => onPreviewStart?.(previewState, { sticky: true }));
  return <div
    className={`overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-transform duration-200 ${exhausted ? "rotate-90" : ""} ${selectable ? lightsaberGlow : ""} ${selectable ? "cursor-pointer" : ""}`}
    {...hold.props}
    onMouseEnter={onPreviewStart ? () => onPreviewStart(previewState) : undefined}
    onMouseLeave={onPreviewEnd}
    onClick={hold.guard(onClick)}
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
  onPreviewStart: PreviewStart;
  onPreviewEnd: () => void;
}) {
  const imageCardId = CardIsLeader(cardId) ? `${cardId}_BACK` : cardId;
  const imageChain = React.useMemo(() => [
    getCardImageLink(imageCardId),
    getSWUDBImageLink(imageCardId),
    getSWUDBImageLinkFallback(imageCardId),
    `/assets/${DEFAULT_PUZZLE_IMAGE}`,
  ], [imageCardId]);
  const [imageStage, setImageStage] = React.useState(0);
  const imageSrc = imageChain[Math.min(imageStage, imageChain.length - 1)];
  const title = CardTitle(cardId);
  const previewState: PreviewState = { imageId: imageCardId, cardId, label: title };
  const hold = useLongPress(() => onPreviewStart(previewState, { sticky: true }));

  React.useEffect(() => { setImageStage(0); }, [imageChain]);

  const inner = (
    <div
      className={`overflow-hidden rounded-b-xl border-x border-b border-white/15 bg-black/40${selectable && onClick ? " ring-2 ring-rose-400/90 shadow-[0_0_10px_rgba(251,113,133,0.5)]" : ""}`}
      {...hold.props}
      style={{ ...hold.props.style, height: 18 }}
      onMouseEnter={() => onPreviewStart(previewState)}
      onMouseLeave={onPreviewEnd}
    >
      <img
        src={imageSrc}
        alt={title}
        className="h-full w-full object-cover"
        style={{ objectPosition: "center 95%" }}
        onError={() => setImageStage(s => Math.min(s + 1, imageChain.length - 1))}
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
  onPreviewStart: PreviewStart;
  onPreviewEnd: () => void;
}) {
  const title = CardTitle(cardId);
  const previewState: PreviewState = { imageId: cardId, cardId, label: title };
  const hold = useLongPress(() => onPreviewStart(previewState, { sticky: true }));

  return (
    <div
      className="overflow-hidden rounded-b-xl border-x border-b border-white/15 bg-gray-500/60"
      {...hold.props}
      style={{ ...hold.props.style, height: 18 }}
      onMouseEnter={() => onPreviewStart(previewState)}
      onMouseLeave={onPreviewEnd}
    >
      <span className="block w-full text-center text-4xs font-semibold uppercase leading-[1.125rem] tracking-wide text-white/70">
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

// A card image locked to the SWUniversity_Cardback aspect ratio (716 × 1000), with a graceful
// primary→fallback source (mirrors CardVisual's fallback behaviour). Used by the Credits / Deck /
// Discard stat panels so every pile renders at a consistent card shape regardless of the source art.
function CardRatioImage({
  primarySrc,
  fallbackSrc,
  alt,
  onPreviewStart,
  onPreviewEnd,
}: {
  primarySrc: string;
  fallbackSrc?: string;
  alt: string;
  onPreviewStart?: (opts?: PreviewOpts) => void;
  onPreviewEnd?: () => void;
}) {
  const [src, setSrc] = React.useState(primarySrc);
  const hold = useLongPress(() => onPreviewStart?.({ sticky: true }));
  React.useEffect(() => { setSrc(primarySrc); }, [primarySrc]);
  return (
    <div
      className="overflow-hidden rounded-md border border-white/10 bg-black/40"
      {...hold.props}
      style={{ ...hold.props.style, aspectRatio: "716 / 1000" }}
      onMouseEnter={onPreviewStart ? () => onPreviewStart() : undefined}
      onMouseLeave={onPreviewEnd}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => { if (fallbackSrc && src !== fallbackSrc) setSrc(fallbackSrc); }}
      />
    </div>
  );
}

// Credits / Deck / Discard stat panel: a centered header, a card-ratio image on the left, and a
// large value on the right. Optionally clickable (Discard opens the pile modal).
function ZoneStatPanel({
  title,
  media,
  value,
  onClick,
  highlight = false,
}: {
  title: string;
  media: React.ReactNode;
  value: React.ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return <div className={`rounded-lg bg-black/20 p-2${highlight ? " ring-2 ring-sky-400/60" : ""}`}>
    <div className="text-center text-2xs font-bold uppercase tracking-[0.2em] text-white/60">{title}</div>
    <div className="mt-2 flex items-center gap-2">
      {onClick
        ? <button type="button" className="w-[42%] shrink-0 cursor-pointer" onClick={onClick}>{media}</button>
        : <div className="w-[42%] shrink-0">{media}</div>}
      <div className="flex flex-1 flex-wrap items-baseline justify-center gap-x-1 text-white">{value}</div>
    </div>
  </div>;
}

// The large right-hand value for a card pile: "N CARDS" (number big, label small).
function pileCountValue(n: number) {
  return <>
    <span className="text-2xl font-black leading-none">{n}</span>
    <span className="text-3xs font-bold uppercase tracking-widest text-white/60">Cards</span>
  </>;
}

function PuzzlesPage({ showBuilderTools = false, isAdmin = false, accessLevel = "public", solvedPuzzleIds: initialSolvedPuzzleIds = [] }: { showBuilderTools?: boolean; isAdmin?: boolean; accessLevel?: PuzzleAccessLevel; solvedPuzzleIds?: string[] }) {
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
  const [silencedPlayIds, setSilencedPlayIds] = React.useState<string[]>([]);
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
  const [puzzleMeta, setPuzzleMeta] = React.useState<{ name: string; author: string; inspiredBy?: string; intendedSolution: string[]; infoText?: string; description?: string; hints?: string[]; alternateFailExplanation?: string } | null>(null);
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const [showSolutionModal, setShowSolutionModal] = React.useState(false);
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [solutionReason, setSolutionReason] = React.useState<"solved" | "revealed">("solved");
  React.useEffect(() => {
    let cancelled = false;
    void getMasteredIds().then(r => { if (!cancelled) setLoggedIn(r.loggedIn); });
    return () => { cancelled = true; };
  }, []);
  const returnToPuzzleMenu = React.useCallback(() => {
    setShowSolutionModal(false);
    setGameState(null);
    setPuzzleName(null);
    setPuzzleMeta(null);
    setShowInfoModal(false);
    setActionError(null);
  }, []);
  const [showHintsModal, setShowHintsModal] = React.useState(false);
  const [openHints, setOpenHints] = React.useState<Set<number>>(new Set());
  const [showFailModal, setShowFailModal] = React.useState(false);
  const [showBuilderPanelOpen, setShowBuilderPanelOpen] = React.useState(false);
  const [lastTestRaw, setLastTestRaw] = React.useState<any | null>(null);
  const [lastTestMeta, setLastTestMeta] = React.useState<{ name?: string; description?: string; infoText?: string; difficulty?: number; author?: string; inspiredBy?: string; intendedSolution?: string[]; hints?: string[]; alternateFailExplanation?: string; assetPath?: string } | null>(null);
  const [editState, setEditState] = React.useState<{ id: string; raw: unknown; meta: { name: string; description: string; infoText: string; difficulty: number; author: string; inspiredBy?: string; intendedSolution: string[]; hints?: string[]; alternateFailExplanation?: string; assetPath?: string } } | null>(null);
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
  // A sticky preview came from a press-and-hold: it opens as a dismissible full-screen card
  // instead of the desktop-only hover panel, which is how touch devices read a card at all.
  const [previewSticky, setPreviewSticky] = React.useState(false);
  // A leader previews as both of its faces; everything else is a single card. Each face owns its
  // own art fallback chain inside <PreviewImage>.
  const previewFaceList = preview ? previewFaces(preview.cardId) : [];

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

  // Mirrors previewSticky for the callbacks below, which must read it without being re-created
  // (they are passed to every card and would otherwise churn the whole board on each change).
  const previewStickyRef = React.useRef(false);
  React.useEffect(() => { previewStickyRef.current = previewSticky; }, [previewSticky]);

  // Preview handlers
  const handlePreviewStart = React.useCallback<PreviewStart>((nextPreview, opts) => {
    if (opts?.sticky) {
      // The hold itself was the delay, and it must not time out from under the player.
      clearPreviewTimer();
      clearPreviewDismissTimer();
      setPreview(nextPreview);
      setPreviewSticky(true);
      previewStickyRef.current = true;
      return;
    }
    // iOS synthesises mouseenter on the held element right after touchend, which would otherwise
    // immediately swap the just-opened detail card for a hover preview the player can't even see.
    if (previewStickyRef.current) return;
    clearPreviewTimer();
    clearPreviewDismissTimer();
    setPreview(null);
    setPreviewSticky(false);
    previewTimerRef.current = setTimeout(() => {
      setPreview(nextPreview);
      previewDismissTimerRef.current = setTimeout(() => {
        setPreview(null);
      }, 10000);
    }, 700);
  }, [clearPreviewTimer, clearPreviewDismissTimer, setPreview]);
  const handlePreviewEnd = React.useCallback(() => {
    // A sticky card stays put — mouseleave fires spuriously on touch once the hold opens it.
    if (previewStickyRef.current) return;
    clearPreviewTimer();
    clearPreviewDismissTimer();
    setPreview(null);
  }, [clearPreviewTimer, clearPreviewDismissTimer, setPreview]);
  const dismissStickyPreview = React.useCallback(() => {
    previewStickyRef.current = false;
    setPreviewSticky(false);
    setPreview(null);
  }, []);
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
      if (payload.response.silencedPlayIds !== undefined) setSilencedPlayIds(payload.response.silencedPlayIds);
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
      // Not gated on `ready`: an Action whose cost has no [Exhaust] (Jabba the Hutt's deployed
      // side) is still usable by an exhausted unit, and the modal's Attack button is rejected by
      // the engine anyway. Only units with no Action at all go straight to attacking.
      if (unit && UNITS_WITH_ACTION_ABILITY[unit.cardId]) {
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

  const handleUnitAbility = React.useCallback((abilityId: string) => {
    if (!unitAbilityModal) return;
    const { playId } = unitAbilityModal;
    setUnitAbilityModal(null);
    void sendDispatch(createDispatch("use-ability", { cardId: abilityId, playId }));
  }, [unitAbilityModal, sendDispatch]);

  const handleBaseClick = React.useCallback((player: PlayerId) => {
    if (isResolving) return;
    if (resolutionNeeded?.type === "Target" && resolutionNeeded.fromZones?.includes("Base")) {
      // Base abilities say "a base" — send which base was clicked, not just the zone.
      void sendDispatch(createDispatch("choose-target", { targetZones: ["Base"], targetPlayers: [player] }));
    } else if (resolutionNeeded?.type === "Target" && resolutionNeeded.fromPlayIds?.includes(`player${player}.base`)) {
      // "Unit or base" abilities (Repair/JTL_075, Daring Raid) encode the base as a literal
      // playId inside fromPlayIds rather than via fromZones — match that form directly.
      void sendDispatch(createDispatch("choose-target", { targetPlayIds: [`player${player}.base`] }));
    } else if (!resolutionNeeded && gameState
        && (BASES_WITH_EPIC_ACTION.has(gameState.player1.base.cardId)
          || BASES_WITH_LIMITED_ACTION.has(gameState.player1.base.cardId))) {
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
        silencedPlayIds?: string[];
        unitBuffs?: Record<string, { power: number; hp: number }>;
        context?: EngineContext;
      };

      if (payload.context) roundTripCtxRef.current = payload.context;
      setGameState(payload.gameState);
      setSentinelPlayIds(payload.sentinelPlayIds ?? []);
      setSilencedPlayIds(payload.silencedPlayIds ?? []);
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
      const { gameState: initialState, sentinelPlayIds: initialSentinelIds, silencedPlayIds: initialSilencedIds, unitBuffs: initialUnitBuffs } = await r.json() as { gameState: GameState; sentinelPlayIds: string[]; silencedPlayIds?: string[]; unitBuffs?: Record<string, { power: number; hp: number }> };

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
      setSilencedPlayIds(initialSilencedIds ?? []);
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

  // Show solution modal and mark solved when puzzle is won
  React.useEffect(() => {
    if (gameState && deriveStatus(gameState) === "won" && puzzleMeta) {
      setSolutionReason("solved");
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

  // Show failure modal when the puzzle is lost, ends in a draw, or reaches the regroup phase.
  React.useEffect(() => {
    if (gameState) {
      const s = deriveStatus(gameState);
      if (s === "lost" || s === "draw" || s === "failed-regroup") setShowFailModal(true);
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
    return <div className="relative z-10 mx-auto w-full max-w-[120rem] px-1.5 py-4 text-white sm:px-4 lg:px-6">
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
            setLastTestMeta({ name: payload.name ?? undefined, description: payload.description ?? undefined, infoText: payload.infoText ?? undefined, difficulty: payload.difficulty ?? undefined, author: payload.author ?? undefined, inspiredBy: payload.inspiredBy ?? undefined, intendedSolution: payload.intendedSolution ?? undefined, hints: payload.hints ?? undefined, alternateFailExplanation: payload.alternateFailExplanation ?? undefined, assetPath: payload.assetPath ?? undefined });

            setIsResolving(true);
            setActionError(null);
            try {
              const initialState = payload.gameState as typeof gameState;
              const initialSentinelIds = payload.sentinelPlayIds ?? [];
              const initialSilencedIds = payload.silencedPlayIds ?? [];
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
              setSilencedPlayIds(initialSilencedIds);
              setUnitBuffs(initialUnitBuffs);
              setGameLog(["Puzzle test loaded."]);
              setResolutionNeeded(null);
              setActionError(null);
              setHistoryLength(0);
              // close builder and show puzzle UI immediately
              setShowBuilderPanelOpen(false);
              const title = payload.name ?? lastTestMeta?.name ?? "Tested Puzzle";
              setPuzzleName(title);
              setPuzzleMeta({ name: title, author: payload.author ?? "", inspiredBy: payload.inspiredBy ?? undefined, intendedSolution: payload.intendedSolution ?? [], infoText: payload.infoText ?? undefined, description: payload.description ?? undefined, hints: payload.hints ?? [], alternateFailExplanation: payload.alternateFailExplanation ?? undefined });
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
        <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 sm:px-4 sm:py-3">
          <LoadPuzzlePanel
            onPuzzleLoaded={(filename, meta) => {
              setSelectedPuzzleFilename(filename);
              setPuzzleName(meta.name);
              setPuzzleMeta({ name: meta.name, author: meta.author, inspiredBy: meta.inspiredBy, intendedSolution: meta.intendedSolution, infoText: meta.infoText, description: meta.description, hints: meta.hints ?? [], alternateFailExplanation: meta.alternateFailExplanation });
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
                  alternateFailExplanation: entry.alternateFailExplanation,
                  assetPath: entry.assetPath,
                },
              });
              setShowBuilderPanelOpen(true);
            }}
            isAdmin={isAdmin}
            accessLevel={accessLevel}
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
  // Abilities that target a RESOURCE (e.g. LAW_013 Chewbacca's "defeat a friendly resource"
  // cost) put resource playIds in fromPlayIds, so the resource row becomes clickable.
  // Both rows are checked: SHD_213 DJ takes control of an ENEMY resource, so the opponent's
  // row has to be selectable too, not just your own.
  const selectableResourcePlayIds: Set<string> =
    resolutionNeeded?.type === "Target" && (resolutionNeeded.fromPlayIds ?? []).length > 0
      ? new Set(
          [...player.resources, ...opponent.resources]
            .filter(r => (resolutionNeeded.fromPlayIds ?? []).includes(r.playId))
            .map(r => r.playId)
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

  // Base targets: an attack restricts to the enemy base (baseTargetPlayers); "a base" ability
  // targets leave it undefined, so either base is a legal choice.
  // Some "unit or base" abilities (Repair/JTL_075, Daring Raid) don't use fromZones at all —
  // they fold "playerN.base" literally into fromPlayIds alongside unit playIds. Recognize that
  // form too, or those bases never render as clickable even though the server accepts them.
  const selectableBaseForPlayer: PlayerId[] = resolutionNeeded?.type === "Target"
    ? (resolutionNeeded.fromZones?.includes("Base")
        ? (resolutionNeeded.baseTargetPlayers ?? [1, 2])
        : ([1, 2] as PlayerId[]).filter(p => resolutionNeeded.fromPlayIds?.includes(`player${p}.base`)))
    : [];
  // Clickable if deploy is still available (even exhausted) OR ability is ready
  const uiCanClickLeader = !resolutionNeeded && !isGameOver && !player.leader.deployed &&
    (player.leader.ready || !player.leader.epicActionUsed);
  const uiCanClickBase = !resolutionNeeded && !isGameOver &&
    ((BASES_WITH_EPIC_ACTION.has(player.base.cardId) && !player.base.epicActionUsed)
      || BASES_WITH_LIMITED_ACTION.has(player.base.cardId));
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

  return <div className="relative z-10 mx-auto w-full max-w-[120rem] px-3 py-4 text-white sm:px-4 lg:px-6">
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
            setPuzzleMeta({ name: meta.name, author: meta.author, inspiredBy: meta.inspiredBy, intendedSolution: meta.intendedSolution, infoText: meta.infoText, description: meta.description, hints: meta.hints ?? [], alternateFailExplanation: meta.alternateFailExplanation });
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
                // hints/assetPath were missing here (but present on the other edit entry point),
                // so editing via this panel silently blanked them on the next save.
                hints: entry.hints,
                alternateFailExplanation: entry.alternateFailExplanation,
                assetPath: entry.assetPath,
              },
            });
            setShowBuilderPanelOpen(true);
          }}
          isAdmin={isAdmin}
          accessLevel={accessLevel}
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
            <h2 className="text-3xs font-semibold uppercase tracking-[0.2em] text-white/70">Game Log</h2>
            <span className="text-3xs text-white/50">{gameLog.length}</span>
          </div>
          <div ref={gameLogRef} className="h-[23vh] space-y-1.5 overflow-y-auto pr-1 text-3xs leading-4 text-white/80">
            {gameLog.map((entry, index) => <div key={`${entry}-${index}`} className="rounded-md bg-black/25 px-1.5 py-1"><CardLinkText text={entry} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} /></div>)}
          </div>
        </section>
        <SectionShell title="Actions" className="mt-2 rounded-lg p-2">
          <div className="mt-2 grid gap-1.5">
            {puzzleMeta?.infoText && puzzleMeta.infoText.trim() ? (
              <button type="button" onClick={() => setShowInfoModal(true)} className="rounded-lg border border-sky-400/30 bg-sky-500/15 px-2 py-1.5 text-left text-2xs font-semibold text-white transition hover:bg-sky-500/25">Puzzle Info</button>
            ) : null}
            <button type="button" onClick={() => void handleUndo()} disabled={isResolving || historyLength === 0} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-2xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
            <button type="button" onClick={handlePass} disabled={isResolving || isGameOver || !!resolutionNeeded} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-2xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Pass</button>
            <button type="button" onClick={handleClaimInitiative} disabled={isResolving || gameState.initiativeClaimed || isGameOver || !!resolutionNeeded} className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-left text-2xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Initiative</button>
            {(puzzleMeta?.hints?.length ?? 0) > 0 ? (
              <button type="button" onClick={() => setShowHintsModal(true)} className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-2 py-1.5 text-left text-2xs font-semibold text-white transition hover:bg-amber-500/25">Hints</button>
            ) : null}
            <div className="h-3" />
            <button type="button" onClick={() => { if (selectedPuzzleFilename !== null) void loadPuzzle(selectedPuzzleFilename); }} disabled={isResolving || selectedPuzzleFilename === null} className="rounded-lg border border-white/15 bg-rose-500/20 px-2 py-1.5 text-left text-2xs font-semibold text-white transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40">Reset</button>
          </div>
          <div className={`mt-1 text-3xs ${lastActionMs !== null && lastActionMs > 600 ? "text-amber-200" : "text-white/55"}`}>
            {isResolving ? "Resolving..." : lastActionMs !== null ? `Last action ${lastActionMs} ms` : "Last action --"}
          </div>
        </SectionShell>
        <SectionShell title="Initiative" className="mt-2 rounded-lg p-2">
          <div className="mt-2 rounded-lg bg-black/25 px-2 py-1.5 text-3xs text-white/75">
            {gameState.initiativePlayer === 1 ? "Player" : "Enemy"}
          </div>
        </SectionShell>
        <SectionShell title="Status" className="mt-2 rounded-lg p-2">
          <div className={`mt-2 rounded-lg border px-2 py-1.5 text-3xs ${statusTone}`}>
            <div>{formatStatus(status, resolutionNeeded)}</div>
            {actionError ? <div className="mt-1 text-3xs text-rose-200">{actionError}</div> : null}
          </div>
        </SectionShell>
      </aside>

      <div className="mx-auto xl:pl-[11.75rem] xl:pr-0 2xl:pl-[12.5rem]">
        <div className="space-y-0">
          <ZonePanel title="Board" hideHeader>
          <div className="space-y-1">
          <div className="space-y-3">
            <div className="grid gap-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                  <span>Resources ({opponent.resources.length})</span>
                  <span className="normal-case tracking-normal text-white/65">{opponent.hand.length} cards in hand</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {opponent.resources.map((resource) => {
                    const isTarget = selectableResourcePlayIds.has(resource.playId);
                    return <FaceDownResource
                      key={resource.playId}
                      cardId={resource.cardId}
                      exhausted={!resource.ready}
                      selectable={isTarget && !isResolving}
                      onClick={isTarget && !isResolving
                        ? () => { void sendDispatch(createDispatch("choose-target", { targetPlayIds: [resource.playId] })); }
                        : undefined}
                    />;
                  })}
                  {opponent.resources.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/40">No resources</div> : null}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ZoneStatPanel
                  title="Credits"
                  media={<CardRatioImage primarySrc="/assets/tokens/credit.webp" alt="Credit token" />}
                  value={<span className="text-2xl font-black leading-none">{opponent.supplemental.creditTokens ?? 0}</span>}
                />
                <ZoneStatPanel
                  title="Deck"
                  media={opponent.deck.length > 0
                    ? <CardRatioImage primarySrc="/assets/SWUniversity_Cardback.png" alt="Deck" />
                    : <div className="rounded-md border border-dashed border-white/10 bg-black/20" style={{ aspectRatio: "716 / 1000" }} />}
                  value={pileCountValue(opponent.deck.length)}
                />
                <ZoneStatPanel
                  title="Discard"
                  media={latestEnemyDiscard
                    ? <CardRatioImage
                        primarySrc={getCardImageLink(latestEnemyDiscard.cardId)}
                        fallbackSrc={getSWUDBImageLink(latestEnemyDiscard.cardId)}
                        alt={CardTitle(latestEnemyDiscard.cardId)}
                        onPreviewStart={(opts) => handlePreviewStart({ imageId: latestEnemyDiscard.cardId, cardId: latestEnemyDiscard.cardId, label: CardTitle(latestEnemyDiscard.cardId) }, opts)}
                        onPreviewEnd={handlePreviewEnd}
                      />
                    : <div className="rounded-md border border-dashed border-white/10 bg-black/20" style={{ aspectRatio: "716 / 1000" }} />}
                  value={pileCountValue(opponent.discard.length)}
                  onClick={latestEnemyDiscard ? () => setDiscardModalPlayer(2) : undefined}
                />
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
                      abilitiesBlanked={silencedPlayIds.includes(unit.playId)}
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
                      abilitiesBlanked={silencedPlayIds.includes(unit.playId)}
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
                  {!opponent.leader.deployed ? <div className="mx-auto w-full max-w-[8.75rem]"><CardVisual
                    cardId={opponent.leader.cardId}
                    selectable={false}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!opponent.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                    epicUsed={opponent.leader.epicActionUsed}
                  /></div> : <div className="mx-auto w-full max-w-[8.75rem] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader is deployed
                  </div>}
                  <div className="mx-auto w-full max-w-[8.75rem]"><CardVisual
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

            <div className="hidden gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_10.3125rem_minmax(0,1fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-row-reverse flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {opponent.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {opponent.spaceArena.map((unit) => <div key={unit.playId} className="relative w-24 shrink-0">
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
                      abilitiesBlanked={silencedPlayIds.includes(unit.playId)}
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
                  {!opponent.leader.deployed ? <div className="mx-auto w-full max-w-[8.75rem]"><CardVisual
                    cardId={opponent.leader.cardId}
                    selectable={false}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!opponent.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                    epicUsed={opponent.leader.epicActionUsed}
                  /></div> : <div className="mx-auto w-full max-w-[8.75rem] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader is deployed
                  </div>}
                  <div className="mx-auto w-full max-w-[8.75rem]"><CardVisual
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
                    Leader is deployed
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
                      abilitiesBlanked={silencedPlayIds.includes(unit.playId)}
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
                  {!player.leader.deployed ? <div className="mx-auto w-full max-w-[8.75rem]"><CardVisual
                    cardId={player.leader.cardId}
                    imageId={leaderFaceImageId(player.leader)}
                    selectable={uiCanClickLeader}
                    onClick={uiCanClickLeader ? () => { if (LEADERS_WITH_ACTION_ABILITY.has(player.leader.cardId) && player.leader.ready) { setLeaderModalOpen(true); } else { handleLeaderDeploy(); } } : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!player.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                    epicUsed={player.leader.epicActionUsed}
                  /></div> : <div className="mx-auto w-full max-w-[8.75rem] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader is deployed
                  </div>}
                  <div className="mx-auto w-full max-w-[8.75rem]"><CardVisual
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
                      abilitiesBlanked={silencedPlayIds.includes(unit.playId)}
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
                      abilitiesBlanked={silencedPlayIds.includes(unit.playId)}
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

            <div className="hidden gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_10.3125rem_minmax(0,1fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibond uppercase tracking-[0.2em] text-white/30">Space</div>
                <div className="relative z-10 flex flex-row-reverse flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden">
                  {player.spaceArena.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No units</div> : null}
                  {player.spaceArena.map((unit) => <div key={unit.playId} className="relative w-24 shrink-0">
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
                      abilitiesBlanked={silencedPlayIds.includes(unit.playId)}
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
                  {!player.leader.deployed ? <div className="mx-auto w-full max-w-[8.75rem]"><CardVisual
                    cardId={player.leader.cardId}
                    imageId={leaderFaceImageId(player.leader)}
                    selectable={uiCanClickLeader}
                    onClick={uiCanClickLeader ? () => { if (LEADERS_WITH_ACTION_ABILITY.has(player.leader.cardId) && player.leader.ready) { setLeaderModalOpen(true); } else { handleLeaderDeploy(); } } : undefined}
                    onPreviewStart={handlePreviewStart}
                    onPreviewEnd={handlePreviewEnd}
                    exhausted={!player.leader.ready}
                    rotateWhenExhausted={false}
                    compact
                    square
                    epicUsed={player.leader.epicActionUsed}
                  /></div> : <div className="mx-auto w-full max-w-[8.75rem] rounded-lg border border-dashed border-amber-300/30 bg-amber-500/10 px-3 py-4 text-xs text-amber-100">
                    Leader is deployed
                  </div>}
                  <div className="mx-auto w-full max-w-[8.75rem]"><CardVisual
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
                    imageId={leaderFaceImageId(player.leader)}
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
                    Leader is deployed
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
                      abilitiesBlanked={silencedPlayIds.includes(unit.playId)}
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

            <div className="grid gap-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
              <div className="relative rounded-lg bg-black/20 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Resources ({player.resources.filter((resource) => resource.ready).length} ready / {player.resources.length})</div>
                <div className="flex flex-wrap gap-2">
                  {player.resources.map((resource) => {
                    const isSmuggleable = smuggleablePlayIds.has(resource.playId);
                    const isResourceTarget = selectableResourcePlayIds.has(resource.playId);
                    // A pending target prompt takes precedence over the Smuggle click.
                    const onResourceClick = isResourceTarget
                      ? () => { void sendDispatch(createDispatch("choose-target", { targetPlayIds: [resource.playId] })); }
                      : isSmuggleable
                        ? () => { void sendDispatch(createDispatch("play-smuggle", { playId: resource.playId })); }
                        : undefined;
                    return <div
                      key={resource.playId}
                      className={`relative ${onResourceClick ? "cursor-pointer" : ""}`}
                      onClick={onResourceClick}
                    >
                      <div className={!resource.ready ? "opacity-40" : ""}>
                        <FaceDownResource
                          cardId={resource.cardId}
                          exhausted={!resource.ready}
                          onPreviewStart={handlePreviewStart}
                          onPreviewEnd={handlePreviewEnd}
                        />
                      </div>
                      {(isSmuggleable || isResourceTarget) && <div className={`pointer-events-none absolute inset-0 rounded-xl ${lightsaberGlow}`} />}
                    </div>;
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ZoneStatPanel
                  title="Credits"
                  media={<CardRatioImage primarySrc="/assets/tokens/credit.webp" alt="Credit token" />}
                  value={<span className="text-2xl font-black leading-none">{player.supplemental.creditTokens ?? 0}</span>}
                />
                <ZoneStatPanel
                  title="Deck"
                  media={player.deck.length > 0
                    ? <CardRatioImage primarySrc="/assets/SWUniversity_Cardback.png" alt="Deck" />
                    : <div className="rounded-md border border-dashed border-white/10 bg-black/20" style={{ aspectRatio: "716 / 1000" }} />}
                  value={pileCountValue(player.deck.length)}
                />
                <ZoneStatPanel
                  title="Discard"
                  highlight={hasDiscardSelection}
                  media={latestPlayerDiscard
                    ? <CardRatioImage
                        primarySrc={getCardImageLink(latestPlayerDiscard.cardId)}
                        fallbackSrc={getSWUDBImageLink(latestPlayerDiscard.cardId)}
                        alt={CardTitle(latestPlayerDiscard.cardId)}
                        onPreviewStart={(opts) => handlePreviewStart({ imageId: latestPlayerDiscard.cardId, cardId: latestPlayerDiscard.cardId, label: CardTitle(latestPlayerDiscard.cardId) }, opts)}
                        onPreviewEnd={handlePreviewEnd}
                      />
                    : <div className="rounded-md border border-dashed border-white/10 bg-black/20" style={{ aspectRatio: "716 / 1000" }} />}
                  value={pileCountValue(player.discard.length)}
                  onClick={latestPlayerDiscard ? () => setDiscardModalPlayer(1) : undefined}
                />
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

    {preview && !previewSticky ? <div className={`pointer-events-none fixed bottom-4 right-4 z-[60] hidden rounded-lg border border-white/15 bg-black/85 p-2 shadow-2xl backdrop-blur-sm lg:block ${previewFaceList.length > 1 ? "w-auto" : "w-[27rem]"}`}>
      {previewFaceList.length > 1 ? (
        // Both leader faces at the SAME card scale, so they share their short edge: the landscape
        // front's height equals the portrait back's width. A back that is another leader face
        // (Flipatine) is landscape too, so it simply matches the front's height instead.
        <div className="flex items-start gap-2">
          {previewFaceList.map(face => (
            <PreviewImage
              key={face.imageId}
              imageId={face.imageId}
              alt={preview.label ?? preview.cardId}
              className={`rounded-xl ${face.landscape ? "h-[10.5rem] w-auto" : "w-[10.5rem] h-auto"}`}
            />
          ))}
        </div>
      ) : (
        <PreviewImage
          imageId={previewFaceList[0]?.imageId ?? preview.imageId}
          alt={preview.label ?? preview.cardId}
          className="w-full rounded-xl object-cover"
        />
      )}
      <div className="mt-2 px-1 text-xs text-white/80">{preview.label ?? CardTitle(preview.cardId)}</div>
    </div> : null}

    {/* Press-and-hold detail. Unlike the hover panel this renders at every width — it is the only
        way to read a card on a touch device, and it must sit above every other modal. */}
    {preview && previewSticky ? <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black/85 p-4 backdrop-blur-sm"
      onClick={dismissStickyPreview}
    >
      {previewFaceList.length > 1 ? (
        // Same shared-short-edge rule as the hover panel, sized in vh. Side by side would be
        // unreadable on a phone, so the pair stacks below the sm breakpoint.
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {previewFaceList.map(face => (
            <PreviewImage
              key={face.imageId}
              imageId={face.imageId}
              alt={preview.label ?? preview.cardId}
              className={`rounded-2xl border border-white/15 shadow-2xl ${face.landscape ? "h-[22vh] w-auto sm:h-[38vh]" : "w-[22vh] h-auto sm:w-[38vh]"}`}
            />
          ))}
        </div>
      ) : (
        <PreviewImage
          imageId={previewFaceList[0]?.imageId ?? preview.imageId}
          alt={preview.label ?? preview.cardId}
          className="max-h-[75vh] w-auto max-w-[min(24rem,90vw)] rounded-2xl border border-white/15 object-contain shadow-2xl"
        />
      )}
      <div className="max-w-[90vw] text-center text-sm font-semibold text-white/90">{preview.label ?? CardTitle(preview.cardId)}</div>
      <button
        type="button"
        onClick={dismissStickyPreview}
        className="rounded-lg border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
      >
        Close
      </button>
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
      <div className={`rounded-xl border border-white/20 bg-[rgba(8,12,26,0.97)] p-6 shadow-2xl${resolutionNeeded?.type === "DeckSearch" ? " w-[min(90vw,43.75rem)]" : " w-[min(90vw,43.75rem)]"}`}>
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
                {resolutionNeeded.helperText ? (
                  <p className="-mt-2 mb-1 max-w-xs text-xs text-white/65">{resolutionNeeded.helperText}</p>
                ) : null}
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
          })() : resolutionNeeded?.type === "Option" ? resolutionNeeded.options.map((opt, optIdx) => {
            const displayLabel = resolutionNeeded.optionLabels?.[optIdx]
              ? resolutionNeeded.optionLabels[optIdx]
              : opt === "Yes" && resolutionNeeded.yesLabel
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
                {resolutionNeeded.optionalDiscard
                  ? resolutionNeeded.thenDrawForTarget
                    ? "You may discard a card. If you do, the opponent draws a card."
                    : "You may discard a card."
                  : resolutionNeeded.mustDiscard ? "Choose a card to discard." : "Opponent's hand — no action required."}
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
              {!resolutionNeeded.mustDiscard || resolutionNeeded.optionalDiscard ? (
                <button type="button" disabled={isResolving}
                  onClick={() => void sendDispatch(createDispatch("choose-target", { targetIndices: [] }))}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
                  {resolutionNeeded.optionalDiscard ? "Discard Nothing" : "Got it"}
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
        <div className="max-h-[80vh] w-[min(90vw,40rem)] overflow-y-auto rounded-xl border border-white/20 bg-[rgba(8,12,26,0.97)] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
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
      <div className="w-[min(92vw,45rem)] max-h-[85dvh] overflow-y-auto rounded-xl border border-sky-400/30 bg-[rgba(8,12,26,0.94)] p-5 sm:p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 border-b border-white/10 pb-4">
          <h3 className="text-lg font-black uppercase tracking-[0.2em] text-white">{puzzleMeta.name || puzzleName}</h3>
          {puzzleMeta.author ? <p className="mt-1 text-xs text-white/50">By {puzzleMeta.author}{puzzleMeta.inspiredBy ? <span className="ml-2 text-white/35">· Inspired by {puzzleMeta.inspiredBy}</span> : null}</p> : null}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-white/85">
          <PuzzleText text={puzzleMeta.infoText ?? ""} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />
        </p>
        <button type="button" onClick={() => setShowInfoModal(false)} className="mt-6 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20">
          Got it
        </button>
      </div>
    </div> : null}

    {showSolutionModal && puzzleMeta ? <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowSolutionModal(false)}>
      <div className="w-[min(92vw,67.5rem)] max-h-[85dvh] overflow-y-auto rounded-xl border border-emerald-400/30 bg-[rgba(8,12,26,0.92)] p-5 sm:p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-bold text-emerald-300">{solutionReason === "revealed" ? "Puzzle Solution" : "Congratulations! You've solved the puzzle!"}</h3>
        <div className="mb-4 border-b border-white/10 pb-4">
          <p className="text-sm font-semibold text-white">{puzzleMeta.name || puzzleName}</p>
          {puzzleMeta.author ? <p className="mt-0.5 text-xs text-white/50">By {puzzleMeta.author}</p> : null}
          {puzzleMeta.inspiredBy ? <p className="mt-0.5 text-xs text-white/40">Inspired by {puzzleMeta.inspiredBy}</p> : null}
        </div>
        {puzzleMeta.intendedSolution.length > 0 ? <>
          <p className="mb-3 text-sm text-white/60">Here&apos;s the author&apos;s intended solution:</p>
          <ul className="mb-5 space-y-2">
            {puzzleMeta.intendedSolution.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/90 min-w-0">
                <img src="/assets/puzzle.svg" alt="" className="mt-1.25 h-2.5 w-2.5 shrink-0 brightness-0 invert" />
                <span className="min-w-0 break-words"><PuzzleText text={step} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} /></span>
              </li>
            ))}
          </ul>
        </> : null}
        <p className="mb-4 text-xs text-white/50">If your solution was different, feel free to let us know on our <a href={DiscordLink} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300">Discord</a>!</p>
        <div className="flex gap-2">
          {solutionReason === "revealed" ? (
            <button type="button" onClick={() => setShowSolutionModal(false)} className="flex-1 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/20">
              Close
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setShowSolutionModal(false)} className="flex-1 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/20">
                Close
              </button>
              <button type="button" onClick={returnToPuzzleMenu} className="flex-1 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500/25">
                Puzzle Home
              </button>
            </>
          )}
        </div>
      </div>
    </div> : null}

    {showHintsModal && (puzzleMeta?.hints?.length ?? 0) > 0 ? <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowHintsModal(false)}>
      <div className="w-[min(90vw,40rem)] max-h-[80vh] overflow-y-auto rounded-xl border border-amber-400/30 bg-[rgba(8,12,26,0.94)] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
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
                  disabled={isOpen}
                  onClick={() => setOpenHints(prev => new Set(prev).add(i))}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-white/90 enabled:hover:bg-white/5 disabled:cursor-default"
                >
                  <span>Hint {i + 1}</span>
                  <span className="text-white/40">{isOpen ? "" : "+"}</span>
                </button>
                {isOpen ? (
                  <p className="whitespace-pre-wrap border-t border-white/10 px-4 py-3 text-sm leading-6 text-white/80">
                    <PuzzleText text={hint} onPreviewStart={handlePreviewStart} onPreviewEnd={handlePreviewEnd} />
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {(() => {
          const hintCount = puzzleMeta?.hints?.length ?? 0;
          const allHintsRevealed = hintCount > 0 && openHints.size === hintCount;
          const canShowSolution = loggedIn && allHintsRevealed;
          return (
            <div className="mt-4 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={!canShowSolution}
                onClick={() => { setShowHintsModal(false); setSolutionReason("revealed"); setShowSolutionModal(true); }}
                className="w-full rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Show Solution
              </button>
              {!loggedIn ? (
                <p className="mt-2 text-center text-xs text-white/40">
                  To see this puzzle&apos;s solution, please register an account.
                </p>
              ) : null}
            </div>
          );
        })()}
        <button type="button" onClick={() => setShowHintsModal(false)} className="mt-6 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20">
          Close
        </button>
      </div>
    </div> : null}

    {showFailModal ? <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowFailModal(false)}>
      <div className="w-[min(90vw,35rem)] rounded-xl border border-rose-400/40 bg-[rgba(8,12,26,0.94)] p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-2 text-base font-bold text-rose-300">Puzzle failed</h3>
        {/* Two ways to fail: your base was destroyed, or you passed to regroup without winning.
            The second cannot be narrated by the engine — the opponent's winning turn is never
            simulated — so it uses the puzzle's authored explanation, falling back to the
            report-it-on-Discord default for puzzles that never authored one. */}
        <p className="mb-6 whitespace-pre-line text-sm text-white/70">
          <PuzzleText
            text={gameState && deriveStatus(gameState) === "failed-regroup"
              ? (puzzleMeta?.alternateFailExplanation?.trim() || DEFAULT_ALTERNATE_FAIL_EXPLANATION)
              : "Your base was defeated. Reset to try again, or head back to the puzzles menu."}
            onPreviewStart={handlePreviewStart}
            onPreviewEnd={handlePreviewEnd}
          />
        </p>
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
          {unitActionsFor(unitAbilityModal.cardId).map((action) => (
            <button key={action.abilityId} type="button" onClick={() => handleUnitAbility(action.abilityId)}
              className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/35">
              Action: {action.label}
            </button>
          ))}
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
