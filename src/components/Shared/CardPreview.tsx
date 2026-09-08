/* eslint-disable react-refresh/only-export-components -- the preview hook, its helpers and
   the overlay component are one cohesive unit; splitting them to satisfy fast-refresh would
   scatter behaviour that always changes together. Same exemption as pages/admin/tools.tsx. */
import React from "react";

import { CardTitle } from "@/server/engine/card-db/generated";
import { CardIsLeader, LeaderHasUnitSide } from "@/server/engine/core-functions";
import { getCardImageLink, getSWUDBImageLink, getSWUDBImageLinkFallback } from "@/util/func";
import { DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";

/**
 * The card blow-up shown when a card is hovered or press-and-held.
 *
 * Extracted from PuzzlesPage so the admin implementation board can reuse it. The behaviour is
 * unchanged from that page: `useCardPreview` owns the state and timers, and `CardPreviewOverlay`
 * renders the desktop hover panel and the touch sticky card.
 */

export type PreviewState = {
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
export type PreviewOpts = { sticky?: boolean };
export type PreviewStart = (preview: PreviewState, opts?: PreviewOpts) => void;

/** Movement (px) past which a touch counts as a scroll rather than a press-and-hold. */
const LONG_PRESS_SLOP = 10;
const LONG_PRESS_MS = 450;

/** How long a hover must rest before the panel opens, and how long it then stays. */
const HOVER_OPEN_MS = 700;
const HOVER_DISMISS_MS = 10000;

/**
 * Short edge (rem) of each leader face in the hover panel. Both faces share it, so the landscape
 * front's height equals the portrait back's width and the pair reads at one card scale.
 *
 * Applied as an inline style rather than a Tailwind arbitrary value on purpose: Tailwind only
 * emits CSS for class strings it can find LITERALLY in the source, so an interpolated
 * `h-[${size}rem]` yields a class name with no rule behind it and the image silently falls back
 * to its intrinsic size. Keeping the number here means one place to change it.
 */
const LEADER_FACE_SHORT_EDGE_REM = 24;

/**
 * Touch handlers that fire `open` on a press-and-hold, and swallow the click that would
 * otherwise follow — without this, holding a selectable card to read it would also target it.
 *
 * Spread onto the same element that carries the hover handlers. That element sits INSIDE the
 * selectable <button>, so its capture-phase click handler runs before the button's onClick and
 * can cancel it.
 */
export function useLongPress(open: () => void) {
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

export function getPreviewImageId(cardId: string, showBack = false): string {
  return showBack ? `${cardId}_BACK` : cardId;
}

/**
 * The art for the face a leader is currently showing. A double-sided leader (TWI_017) flips to
 * its BACK image — for Flipatine that really is a different character, Darth Sidious.
 */
export function leaderFaceImageId(leader: { cardId: string; flipped?: boolean }): string {
  return getPreviewImageId(leader.cardId, leader.flipped === true);
}

/** One face to show in a preview, and whether its art is landscape. */
export type PreviewFace = { imageId: string; landscape: boolean };

/**
 * The faces a preview shows. A leader always previews as BOTH sides, whichever one the player
 * happened to hover — the leader in its zone, the deployed leader unit in an arena, the leader
 * attached as a Pilot upgrade, and `@[ID-L]` links in puzzle text all land here.
 *
 * Orientation cannot be read from the id: `isHorizontalCard` treats every `_BACK` as portrait,
 * which is right for a deployed unit side but wrong for a double-sided leader, whose back is
 * another landscape leader face (TWI_017 → Darth Sidious). `LeaderHasUnitSide` is the real signal.
 */
export function previewFaces(cardId: string): PreviewFace[] {
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
export function PreviewImage(
  { imageId, alt, className, style }:
  { imageId: string; alt: string; className?: string; style?: React.CSSProperties },
) {
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
      style={style}
      onError={() => setStage(s => Math.min(s + 1, chain.length - 1))}
    />
  );
}

export type CardPreviewController = {
  preview: PreviewState | null;
  previewSticky: boolean;
  previewFaceList: PreviewFace[];
  onPreviewStart: PreviewStart;
  onPreviewEnd: () => void;
  dismissSticky: () => void;
};

/**
 * Owns the preview state and its two timers. Lifted out of PuzzlesPage verbatim so both that page
 * and the admin board share one implementation of the hover-delay / sticky-hold interplay.
 */
export function useCardPreview(): CardPreviewController {
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const onPreviewStart = React.useCallback<PreviewStart>((nextPreview, opts) => {
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
      }, HOVER_DISMISS_MS);
    }, HOVER_OPEN_MS);
  }, [clearPreviewTimer, clearPreviewDismissTimer, setPreview]);

  const onPreviewEnd = React.useCallback(() => {
    // A sticky card stays put — mouseleave fires spuriously on touch once the hold opens it.
    if (previewStickyRef.current) return;
    clearPreviewTimer();
    clearPreviewDismissTimer();
    setPreview(null);
  }, [clearPreviewTimer, clearPreviewDismissTimer, setPreview]);

  const dismissSticky = React.useCallback(() => {
    previewStickyRef.current = false;
    setPreviewSticky(false);
    setPreview(null);
  }, []);

  React.useEffect(() => () => { clearPreviewTimer(); clearPreviewDismissTimer(); },
    [clearPreviewTimer, clearPreviewDismissTimer]);

  return { preview, previewSticky, previewFaceList, onPreviewStart, onPreviewEnd, dismissSticky };
}

/**
 * Both preview surfaces: the desktop-only hover panel pinned bottom-right, and the press-and-hold
 * detail card that covers the screen at every width. Render once per page.
 */
export function CardPreviewOverlay(
  { preview, previewSticky, previewFaceList, dismissSticky }: CardPreviewController,
) {
  return (
    <>
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
                className="rounded-xl"
                style={face.landscape
                  ? { height: `${LEADER_FACE_SHORT_EDGE_REM}rem`, width: "auto" }
                  : { width: `${LEADER_FACE_SHORT_EDGE_REM}rem`, height: "auto" }}
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
        onClick={dismissSticky}
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
          onClick={dismissSticky}
          className="rounded-lg border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          Close
        </button>
      </div> : null}
    </>
  );
}
