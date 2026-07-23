import React from "react";
import { getCardImageLink, getSWUDBImageLink, getSWUDBImageLinkFallback } from "@/util/func";
import { DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";
import type { BuilderState, PlayerBuilderState, UnitEntry } from "./puzzle-builder-state";
import type { CardCatalogEntry } from "./PuzzleBuilderPanel";

type Side = "both" | 1 | 2;

/** A single non-interactive card tile with a fallback chain ending at the card back. */
function CardTile({ cardId, sub, widthClass }: { cardId: string; sub?: string; widthClass: string }) {
  // Fallback order: generated art -> swudb import -> swudb CDN -> default card back.
  const [stage, setStage] = React.useState(0);
  const src =
    stage === 0 ? getCardImageLink(cardId)
    : stage === 1 ? getSWUDBImageLink(cardId)
    : stage === 2 ? getSWUDBImageLinkFallback(cardId)
    : `/assets/${DEFAULT_PUZZLE_IMAGE}`;
  return (
    <div className={`shrink-0 ${widthClass}`}>
      <img
        src={src}
        alt=""
        draggable={false}
        onError={() => setStage((s) => Math.min(s + 1, 3))}
        className="pointer-events-none w-full rounded border border-white/20 bg-black/30 select-none"
      />
      {sub ? <div className="mt-0.5 text-center text-[9px] text-white/50">{sub}</div> : null}
    </div>
  );
}

function unitSub(u: UnitEntry): string | undefined {
  const bits: string[] = [];
  if (u.damage > 0) bits.push(`${u.damage} dmg`);
  if (!u.ready) bits.push("exhausted");
  if (u.upgrades.length) bits.push(`+${u.upgrades.length}`);
  return bits.length ? bits.join(" · ") : undefined;
}

function PlayerRow({ p, label, compact }: { p: PlayerBuilderState; label: string; compact: boolean }) {
  const w = compact ? "w-10" : "w-16";
  const zone = (title: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">{title}</div>
      <div className="flex flex-wrap items-start gap-1">{children}</div>
    </div>
  );
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">{label}</div>
      <div className="flex flex-wrap gap-3">
        {zone("Base", p.baseCardId
          ? <CardTile cardId={p.baseCardId} sub={p.baseDamage > 0 ? `${p.baseDamage} dmg` : undefined} widthClass={w} />
          : <span className="text-[10px] text-white/30">—</span>)}
        {zone("Leader", p.leaderCardId
          ? <CardTile cardId={p.leaderDeployed ? `${p.leaderCardId}_BACK` : p.leaderCardId} sub={p.leaderDeployed ? "deployed" : undefined} widthClass={w} />
          : <span className="text-[10px] text-white/30">—</span>)}
      </div>
      {p.spaceUnits.length > 0 && zone("Space",
        p.spaceUnits.map((u, i) => <CardTile key={i} cardId={u.cardId} sub={unitSub(u)} widthClass={w} />))}
      {p.groundUnits.length > 0 && zone("Ground",
        p.groundUnits.map((u, i) => <CardTile key={i} cardId={u.cardId} sub={unitSub(u)} widthClass={w} />))}
      <div className="text-[10px] text-white/50">
        Resources {p.resources.filter((r) => r.ready).length}/{p.resources.length}
        {" · "}Hand {p.handCards.length}
        {" · "}Deck {p.deck.length}
        {" · "}Discard {p.discard.length}
        {p.creditTokens > 0 ? ` · ${p.creditTokens} credit` : ""}
        {p.forceToken ? " · Force" : ""}
      </div>
    </div>
  );
}

export function StaticBoard({ state, side, compact = false }: { state: BuilderState; cards: CardCatalogEntry[]; side: Side; compact?: boolean }) {
  const rows: React.ReactNode[] = [];
  if (side === "both" || side === 2) rows.push(<PlayerRow key="p2" p={state.player2} label="Player 2 (Opponent)" compact={compact} />);
  if (side === "both" || side === 1) rows.push(<PlayerRow key="p1" p={state.player1} label="Player 1 (You)" compact={compact} />);
  return <div className="pointer-events-none select-none space-y-2">{rows}</div>;
}
