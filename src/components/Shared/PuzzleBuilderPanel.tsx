import React from "react";
import { globalBackgroundStyle } from "@/util/style-const";
import { normalizePuzzleAssetPath, puzzleImageSrc, DEFAULT_PUZZLE_IMAGE } from "@/util/puzzle-image";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { GamePhase } from "@/lib/engine/core-models";
import type { SolverResult } from "@/server/puzzle/solver";

export type CardCatalogEntry = {
  cardId: string;
  label: string;
  type: string;
};

// ---------------------------------------------------------------------------
// Fuzzy search helper
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function fuzzyMatch(query: string, label: string): boolean {
  const q = normalize(query);
  const l = normalize(label);
  if (q.length === 0) return true;
  if (l.includes(q)) return true;
  // Allow 1 extra char in query (e.g. "Yodaa" → "Yoda")
  if (q.length > 2) {
    for (let i = 0; i < q.length; i++) {
      const reduced = q.slice(0, i) + q.slice(i + 1);
      if (l.includes(reduced)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Card picker sub-component
// ---------------------------------------------------------------------------

type CardPickerProps = {
  cards: CardCatalogEntry[];
  value: string;
  onChange: (cardId: string) => void;
  placeholder?: string;
  filterType?: string[];
  id?: string;
};

function CardPicker({ cards, value, onChange, placeholder = "Search cards…", filterType, id }: CardPickerProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedLabel = React.useMemo(
    () => cards.find((c) => c.cardId === value)?.label ?? "",
    [cards, value],
  );

  const filtered = React.useMemo(() => {
    let pool = cards;
    if (filterType && filterType.length > 0) {
      pool = pool.filter((c) => filterType.includes(c.type));
    }
    if (!query.trim()) return pool.slice(0, 20);
    return pool.filter((c) => fuzzyMatch(query, c.label)).slice(0, 20);
  }, [cards, query, filterType]);

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative" id={id}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-left text-xs text-white/90 hover:border-white/30"
      >
        {value ? selectedLabel : <span className="text-white/40">{placeholder}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-white/20 bg-[rgba(10,15,35,0.98)] shadow-xl backdrop-blur-sm">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter…"
            className="w-full rounded-t-lg bg-black/40 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30"
          />
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-white/40">No matches</li>
            ) : (
              filtered.map((c) => (
                <li key={c.cardId}>
                  <button
                    type="button"
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 ${c.cardId === value ? "bg-white/15 text-white" : "text-white/80"}`}
                    onClick={() => { onChange(c.cardId); setOpen(false); setQuery(""); }}
                  >
                    {c.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable field row
// ---------------------------------------------------------------------------

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-start gap-2">
      <label className="pt-1.5 text-[11px] text-white/55">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min = 0, max = 99 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none"
    />
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-blue-400" />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Builder state types
// ---------------------------------------------------------------------------

type UnitEntry = { cardId: string; ready: boolean; damage: number; upgrades: string[]; captives: string[] };
type ResourceEntry = { cardId: string; ready: boolean };

type PlayerBuilderState = {
  baseCardId: string;
  baseDamage: number;
  baseEpicActionUsed: boolean;
  leaderCardId: string;
  leaderReady: boolean;
  leaderDeployed: boolean;
  leaderEpicActionUsed: boolean;
  resources: ResourceEntry[];
  handCards: string[];
  deck: string[];
  groundUnits: UnitEntry[];
  spaceUnits: UnitEntry[];
};

type BuilderState = {
  name: string;
  description: string;
  infoText: string;
  difficulty: number;
  author: string;
  inspiredBy?: string;
  intendedSolution: string[];
  assetPath: string;
  activePlayer: 1 | 2;
  gamePhase: GamePhase;
  currentRound: number;
  initiativePlayer: 1 | 2;
  initiativeClaimed: boolean;
  player1: PlayerBuilderState;
  player2: PlayerBuilderState;
};

function emptyPlayer(): PlayerBuilderState {
  return {
    baseCardId: "", baseDamage: 0, baseEpicActionUsed: false,
    leaderCardId: "", leaderReady: true, leaderDeployed: false, leaderEpicActionUsed: false,
    resources: [], handCards: [], deck: [], groundUnits: [], spaceUnits: [],
  };
}

function initialBuilderState(): BuilderState {
  return {
    name: "",
    description: "",
    infoText: "",
    difficulty: 1,
    author: "",
    inspiredBy: "",
    intendedSolution: [],
    assetPath: "",
    activePlayer: 1,
    gamePhase: "ActionPhase" as GamePhase,
    currentRound: 1,
    initiativePlayer: 2,
    initiativeClaimed: true,
    player1: emptyPlayer(),
    player2: {
      ...emptyPlayer(),
      deck: ["LAW_260", "LAW_260", "LOF_254", "LOF_254", "LOF_254"],
    },
  };
}

// ---------------------------------------------------------------------------
// Convert RawGameState → builder state (used for JSON import)
// ---------------------------------------------------------------------------

const PHASE_NAMES = ["ActionPhase", "RegroupDraw", "RegroupResource", "RegroupReady"] as const;

function resolvePhase(raw: unknown): GamePhase {
  if (typeof raw === "number") return (PHASE_NAMES[raw] ?? "ActionPhase") as GamePhase;
  if (typeof raw === "string" && (PHASE_NAMES as readonly string[]).includes(raw)) return raw as GamePhase;
  return "ActionPhase" as GamePhase;
}

function parseRawPlayer(p: Record<string, unknown>): PlayerBuilderState {
  const base = (p.base ?? {}) as Record<string, unknown>;
  const leader = (p.leader ?? {}) as Record<string, unknown>;
  const ground = (p.groundArena ?? []) as Record<string, unknown>[];
  const space = (p.spaceArena ?? []) as Record<string, unknown>[];
  const resources = (p.resources ?? []) as Record<string, unknown>[];
  const hand = (p.hand ?? []) as Record<string, unknown>[];
  const deck = (p.deck ?? []) as Record<string, unknown>[];
  return {
    baseCardId: String(base.cardId ?? ""),
    baseDamage: Number(base.damage ?? 0),
    baseEpicActionUsed: Boolean(base.epicActionUsed),
    leaderCardId: String(leader.cardId ?? ""),
    leaderReady: leader.ready !== false,
    leaderDeployed: Boolean(leader.deployed),
    leaderEpicActionUsed: Boolean(leader.epicActionUsed),
    resources: resources.map((r) => ({ cardId: String(r.cardId ?? ""), ready: r.ready !== false })),
    handCards: hand.map((h) => String((h as Record<string, unknown>).cardId ?? "")),
    deck: deck.map((d) => String(d.cardId ?? "")),
    groundUnits: ground.map((u) => ({
      cardId: String(u.cardId ?? ""), ready: u.ready !== false, damage: Number(u.damage ?? 0),
      upgrades: ((u.upgrades ?? []) as Record<string, unknown>[]).map((ug) => String(ug.cardId ?? "")),
      captives: ((u.captives ?? []) as Record<string, unknown>[]).map((c) => String(c.cardId ?? "")),
    })),
    spaceUnits: space.map((u) => ({
      cardId: String(u.cardId ?? ""), ready: u.ready !== false, damage: Number(u.damage ?? 0),
      upgrades: ((u.upgrades ?? []) as Record<string, unknown>[]).map((ug) => String(ug.cardId ?? "")),
      captives: ((u.captives ?? []) as Record<string, unknown>[]).map((c) => String(c.cardId ?? "")),
    })),
  };
}

function fromRaw(raw: Record<string, unknown>, meta: { name: string; description: string; infoText?: string; difficulty: number; author?: string; inspiredBy?: string; intendedSolution?: string[]; assetPath?: string }): BuilderState {
  return {
    name: meta.name,
    description: meta.description,
    infoText: meta.infoText ?? "",
    difficulty: meta.difficulty,
    author: meta.author ?? "",
    inspiredBy: meta.inspiredBy ?? "",
    intendedSolution: meta.intendedSolution ?? [],
    assetPath: meta.assetPath ?? "",
    activePlayer: Number(raw.activePlayer) === 2 ? 2 : 1,
    gamePhase: resolvePhase(raw.gamePhase),
    currentRound: Number(raw.currentRound ?? 1),
    initiativePlayer: Number(raw.initiativePlayer) === 2 ? 2 : 1,
    initiativeClaimed: raw.initiativeClaimed !== false,
    player1: parseRawPlayer((raw.player1 ?? {}) as Record<string, unknown>),
    player2: parseRawPlayer((raw.player2 ?? {}) as Record<string, unknown>),
  };
}

// ---------------------------------------------------------------------------
// Convert builder state → RawGameState
// ---------------------------------------------------------------------------

function toRaw(s: BuilderState): RawPuzzleGameState {
  function mapPlayer(p: PlayerBuilderState, playerId: 1 | 2) {
    return {
      base: { cardId: p.baseCardId, damage: p.baseDamage, epicActionUsed: p.baseEpicActionUsed },
      leader: { cardId: p.leaderCardId, ready: p.leaderReady, deployed: p.leaderDeployed, epicActionUsed: p.leaderEpicActionUsed },
      groundArena: p.groundUnits.map((u) => ({
        cardId: u.cardId, playId: "@", owner: playerId, controller: playerId,
        ready: u.ready, damage: u.damage,
        upgrades: u.upgrades.map((cardId) => ({ cardId, playId: "@", owner: playerId, controller: playerId })),
        captives: u.captives.map((cardId) => ({ cardId, playId: "@", owner: playerId, controller: playerId })),
      })),
      spaceArena: p.spaceUnits.map((u) => ({
        cardId: u.cardId, playId: "@", owner: playerId, controller: playerId,
        ready: u.ready, damage: u.damage,
        upgrades: u.upgrades.map((cardId) => ({ cardId, playId: "@", owner: playerId, controller: playerId })),
        captives: u.captives.map((cardId) => ({ cardId, playId: "@", owner: playerId, controller: playerId })),
      })),
      resources: p.resources.map((r) => ({
        cardId: r.cardId, playId: "@", owner: playerId, controller: playerId, ready: r.ready,
      })),
      discard: [],
      deck: p.deck.map((cardId) => ({ cardId })),
      hand: p.handCards.map((cardId) => ({ cardId })),
      supplemental: {},
    };
  }

  return {
    activePlayer: s.activePlayer,
    gamePhase: s.gamePhase,
    nextPlayId: 1,
    currentRound: s.currentRound,
    initiativePlayer: s.initiativePlayer,
    initiativeClaimed: s.initiativeClaimed,
    player1: mapPlayer(s.player1, 1),
    player2: mapPlayer(s.player2, 2),
    currentEffects: [],
    triggerBag: [],
  } as unknown as RawPuzzleGameState;
}

// ---------------------------------------------------------------------------
// Per-player section
// ---------------------------------------------------------------------------

type PlayerSectionProps = {
  label: string;
  state: PlayerBuilderState;
  cards: CardCatalogEntry[];
  onChange: (next: PlayerBuilderState) => void;
};

function PlayerSection({ label, state, cards, onChange }: PlayerSectionProps) {
  const [newHandCardId, setNewHandCardId] = React.useState("");
  const [newResourceCardId, setNewResourceCardId] = React.useState("");
  const [newResourceCount, setNewResourceCount] = React.useState(1);
  const [newResourceReady, setNewResourceReady] = React.useState(true);
  const [newDeckCardId, setNewDeckCardId] = React.useState("");
  const [newDeckCount, setNewDeckCount] = React.useState(1);
  const [showDeck, setShowDeck] = React.useState(false);

  const unitCards = React.useMemo(
    () => cards.filter((c) => c.type === "Unit" || c.type === "Leader"),
    [cards],
  );

  function patch(delta: Partial<PlayerBuilderState>) {
    onChange({ ...state, ...delta });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/60">{label}</h3>

      {/* Base */}
      <div className="rounded-lg bg-black/20 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Base</div>
        <FieldRow label="Card">
          <CardPicker
            cards={cards}
            filterType={["Base"]}
            value={state.baseCardId}
            onChange={(v) => patch({ baseCardId: v })}
            placeholder="Select base…"
          />
        </FieldRow>
        <FieldRow label="Damage">
          <NumberInput value={state.baseDamage} onChange={(v) => patch({ baseDamage: v })} />
        </FieldRow>
        <Checkbox checked={state.baseEpicActionUsed} onChange={(v) => patch({ baseEpicActionUsed: v })} label="Epic Action Used" />
      </div>

      {/* Leader */}
      <div className="rounded-lg bg-black/20 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Leader</div>
        <FieldRow label="Card">
          <CardPicker
            cards={cards}
            filterType={["Leader"]}
            value={state.leaderCardId}
            onChange={(v) => patch({ leaderCardId: v })}
            placeholder="Select leader…"
          />
        </FieldRow>
        <div className="flex flex-wrap gap-3">
          <Checkbox checked={state.leaderReady} onChange={(v) => patch({ leaderReady: v })} label="Ready" />
          <Checkbox checked={state.leaderDeployed} onChange={(v) => patch({ leaderDeployed: v })} label="Deployed" />
          <Checkbox checked={state.leaderEpicActionUsed} onChange={(v) => patch({ leaderEpicActionUsed: v })} label="Epic Used" />
        </div>
      </div>

      {/* Resources */}
      <div className="rounded-lg bg-black/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Resources ({state.resources.length})</div>
          {state.resources.length > 0 && (
            <button
              type="button"
              onClick={() => patch({ resources: [] })}
              className="text-[10px] text-white/30 hover:text-rose-300"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-[1fr_4rem_auto_auto] items-center gap-2">
          <CardPicker cards={cards} value={newResourceCardId} onChange={setNewResourceCardId} placeholder="Card…" />
          <div>
            <input
              type="number"
              min={1}
              max={20}
              value={newResourceCount}
              onChange={(e) => setNewResourceCount(Math.max(1, Math.min(20, Number(e.target.value))))}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none"
            />
          </div>
          <Checkbox checked={newResourceReady} onChange={setNewResourceReady} label="Ready" />
          <button
            type="button"
            disabled={!newResourceCardId}
            onClick={() => {
              const added = Array.from({ length: newResourceCount }, () => ({ cardId: newResourceCardId, ready: newResourceReady }));
              patch({ resources: [...state.resources, ...added] });
              setNewResourceCardId("");
              setNewResourceCount(1);
            }}
            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {state.resources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {state.resources.map((r, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${r.ready ? "bg-blue-500/20 text-blue-200" : "bg-white/10 text-white/50"}`}>
                {cards.find((c) => c.cardId === r.cardId)?.label ?? r.cardId}
                <button
                  type="button"
                  onClick={() => patch({ resources: state.resources.filter((_, j) => j !== i) })}
                  className="ml-0.5 text-white/40 hover:text-white/70"
                >×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hand */}
      <div className="rounded-lg bg-black/20 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Hand ({state.handCards.length})</div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <CardPicker cards={cards} value={newHandCardId} onChange={setNewHandCardId} placeholder="Card…" />
          <button
            type="button"
            disabled={!newHandCardId}
            onClick={() => {
              patch({ handCards: [...state.handCards, newHandCardId] });
              setNewHandCardId("");
            }}
            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {state.handCards.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {state.handCards.map((cardId, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                {cards.find((c) => c.cardId === cardId)?.label ?? cardId}
                <button
                  type="button"
                  onClick={() => patch({ handCards: state.handCards.filter((_, j) => j !== i) })}
                  className="ml-0.5 text-white/40 hover:text-white/70"
                >×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Deck */}
      <div className="rounded-lg bg-black/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Deck ({state.deck.length})</div>
          <div className="flex items-center gap-2">
            {state.deck.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeck((v) => !v)}
                className="text-[10px] text-white/40 hover:text-white/70 underline-offset-2 underline"
              >
                {showDeck ? "Hide" : "See Deck"}
              </button>
            )}
            {state.deck.length > 0 && (
              <button
                type="button"
                onClick={() => patch({ deck: [] })}
                className="text-[10px] text-white/30 hover:text-rose-300"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_4rem_auto] items-center gap-2">
          <CardPicker cards={cards} value={newDeckCardId} onChange={setNewDeckCardId} placeholder="Card…" />
          <input
            type="number"
            min={1}
            max={60}
            value={newDeckCount}
            onChange={(e) => setNewDeckCount(Math.max(1, Math.min(60, Number(e.target.value))))}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none"
          />
          <button
            type="button"
            disabled={!newDeckCardId}
            onClick={() => {
              const added = Array.from({ length: newDeckCount }, () => newDeckCardId);
              patch({ deck: [...state.deck, ...added] });
              setNewDeckCardId("");
              setNewDeckCount(1);
            }}
            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {showDeck && state.deck.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {[...state.deck].reverse().map((cardId, i) => {
              const originalIndex = state.deck.length - 1 - i;
              return (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                  {cards.find((c) => c.cardId === cardId)?.label ?? cardId}
                  <button
                    type="button"
                    onClick={() => patch({ deck: state.deck.filter((_, j) => j !== originalIndex) })}
                    className="ml-0.5 text-white/40 hover:text-white/70"
                  >×</button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Ground Arena */}
      <div className="rounded-lg bg-black/20 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Ground Arena ({state.groundUnits.length})</div>
        <UnitAdder
          unitCards={unitCards}
          units={state.groundUnits}
          cards={cards}
          onAdd={(u) => patch({ groundUnits: [...state.groundUnits, u] })}
          onRemove={(i) => patch({ groundUnits: state.groundUnits.filter((_, j) => j !== i) })}
          onUpdate={(i, u) => patch({ groundUnits: state.groundUnits.map((x, j) => j === i ? u : x) })}
        />
      </div>

      {/* Space Arena */}
      <div className="rounded-lg bg-black/20 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Space Arena ({state.spaceUnits.length})</div>
        <UnitAdder
          unitCards={unitCards}
          units={state.spaceUnits}
          cards={cards}
          onAdd={(u) => patch({ spaceUnits: [...state.spaceUnits, u] })}
          onRemove={(i) => patch({ spaceUnits: state.spaceUnits.filter((_, j) => j !== i) })}
          onUpdate={(i, u) => patch({ spaceUnits: state.spaceUnits.map((x, j) => j === i ? u : x) })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unit edit dialog (upgrades / captives)
// ---------------------------------------------------------------------------

type UnitEditDialogProps = {
  unit: UnitEntry;
  type: "upgrades" | "captives";
  cards: CardCatalogEntry[];
  unitCards: CardCatalogEntry[];
  onUpdate: (next: UnitEntry) => void;
  onClose: () => void;
};

function UnitEditDialog({ unit, type, cards, unitCards, onUpdate, onClose }: UnitEditDialogProps) {
  const [newCardId, setNewCardId] = React.useState("");
  const isUpgrades = type === "upgrades";
  const items = isUpgrades ? unit.upgrades : unit.captives;
  const pickerCards = isUpgrades ? cards.filter((c) => c.type === "Upgrade") : unitCards;
  const unitName = cards.find((c) => c.cardId === unit.cardId)?.label ?? unit.cardId;

  function addItem() {
    if (!newCardId) return;
    const next = [...items, newCardId];
    onUpdate(isUpgrades ? { ...unit, upgrades: next } : { ...unit, captives: next });
    setNewCardId("");
  }

  function removeItem(i: number) {
    const next = items.filter((_, j) => j !== i);
    onUpdate(isUpgrades ? { ...unit, upgrades: next } : { ...unit, captives: next });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-80 rounded-2xl border border-white/10 bg-[rgba(5,8,20,0.97)] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white">
              {isUpgrades ? "Upgrades" : "Captives"}
            </div>
            <div className="text-[11px] text-white/40">{unitName}</div>
          </div>
          <button type="button" onClick={onClose} className="text-lg leading-none text-white/30 hover:text-white">×</button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <CardPicker
            cards={pickerCards}
            value={newCardId}
            onChange={setNewCardId}
            placeholder={isUpgrades ? "Search upgrades…" : "Search units…"}
          />
          <button
            type="button"
            disabled={!newCardId}
            onClick={addItem}
            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {items.length > 0 ? (
          <div className="space-y-1">
            {items.map((cardId, i) => (
              <div key={i} className="flex items-center justify-between rounded-md bg-black/20 px-2 py-1 text-[11px]">
                <span className="text-white/80">{cards.find((c) => c.cardId === cardId)?.label ?? cardId}</span>
                <button type="button" onClick={() => removeItem(i)} className="text-white/30 hover:text-rose-300">×</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-white/30">None added.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UnitAdder({ unitCards, units, cards, onAdd, onRemove, onUpdate }: {
  unitCards: CardCatalogEntry[];
  units: UnitEntry[];
  cards: CardCatalogEntry[];
  onAdd: (u: UnitEntry) => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, u: UnitEntry) => void;
}) {
  const [cardId, setCardId] = React.useState("");
  const [ready, setReady] = React.useState(true);
  const [damage, setDamage] = React.useState(0);
  const [editDialog, setEditDialog] = React.useState<{ index: number; type: "upgrades" | "captives" } | null>(null);

  return (
    <>
      <div className="grid grid-cols-[1fr_3.5rem_auto_auto] items-center gap-2">
        <CardPicker cards={unitCards} value={cardId} onChange={setCardId} placeholder="Unit…" />
        <input
          type="number"
          min={0}
          max={99}
          value={damage}
          title="Damage"
          placeholder="dmg"
          onChange={(e) => setDamage(Math.max(0, Number(e.target.value)))}
          className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none"
        />
        <Checkbox checked={ready} onChange={setReady} label="Ready" />
        <button
          type="button"
          disabled={!cardId}
          onClick={() => { onAdd({ cardId, ready, damage, upgrades: [], captives: [] }); setCardId(""); setDamage(0); setReady(true); }}
          className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {units.length > 0 && (
        <div className="space-y-1.5">
          {units.map((u, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center gap-1.5 rounded-md bg-black/20 px-2 py-1 text-[11px]">
                <span className="text-white/80 mr-0.5">
                  {cards.find((c) => c.cardId === u.cardId)?.label ?? u.cardId}
                  {u.damage > 0 ? <span className="ml-1.5 text-rose-300">({u.damage} dmg)</span> : null}
                  {!u.ready ? <span className="ml-1.5 text-white/40">[exhausted]</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => setEditDialog({ index: i, type: "upgrades" })}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-300 bg-blue-500/15 hover:bg-blue-500/30 transition-colors"
                >
                  {u.upgrades.length > 0 ? `Upgrades (${u.upgrades.length})` : "Upgrades"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditDialog({ index: i, type: "captives" })}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white/50 bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {u.captives.length > 0 ? `Captives (${u.captives.length})` : "Captives"}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="ml-auto text-white/30 hover:text-rose-300"
                >×</button>
              </div>
              {u.upgrades.length > 0 && (
                <div className="ml-3 flex flex-wrap gap-1">
                  {u.upgrades.map((cardId, j) => (
                    <span key={j} className="text-[10px] text-blue-300/70">
                      {cards.find((c) => c.cardId === cardId)?.label ?? cardId}
                      {j < u.upgrades.length - 1 ? "," : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editDialog && (
        <UnitEditDialog
          unit={units[editDialog.index]}
          type={editDialog.type}
          cards={cards}
          unitCards={unitCards}
          onUpdate={(next) => onUpdate(editDialog.index, next)}
          onClose={() => setEditDialog(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Board preview
// ---------------------------------------------------------------------------

function BoardPreview({ state, cards }: { state: BuilderState; cards: CardCatalogEntry[] }) {
  function cardName(cardId: string) {
    return cards.find((c) => c.cardId === cardId)?.label ?? cardId;
  }

  function PlayerPreview({ p, label }: { p: PlayerBuilderState; label: string }) {
    return (
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">{label}</div>
        <div className="text-[11px] text-white/70">
          <span className="text-white/40">Base: </span>
          {p.baseCardId ? `${cardName(p.baseCardId)} (${p.baseDamage} dmg)` : "—"}
        </div>
        <div className="text-[11px] text-white/70">
          <span className="text-white/40">Leader: </span>
          {p.leaderCardId ? cardName(p.leaderCardId) : "—"}
          {p.leaderDeployed ? " [deployed]" : ""}
        </div>
        {p.groundUnits.length > 0 && (
          <div className="text-[11px] text-white/70">
            <span className="text-white/40">Ground: </span>
            {p.groundUnits.map((u, i) => (
              <span key={i}>{i > 0 ? ", " : ""}{cardName(u.cardId)}{u.damage > 0 ? ` (${u.damage})` : ""}</span>
            ))}
          </div>
        )}
        {p.spaceUnits.length > 0 && (
          <div className="text-[11px] text-white/70">
            <span className="text-white/40">Space: </span>
            {p.spaceUnits.map((u, i) => (
              <span key={i}>{i > 0 ? ", " : ""}{cardName(u.cardId)}{u.damage > 0 ? ` (${u.damage})` : ""}</span>
            ))}
          </div>
        )}
        <div className="text-[11px] text-white/70">
          <span className="text-white/40">Resources: </span>
          {p.resources.length > 0
            ? `${p.resources.filter((r) => r.ready).length} ready / ${p.resources.length} total`
            : "0"}
        </div>
        {p.deck.length > 0 && (
          <div className="text-[11px] text-white/70">
            <span className="text-white/40">Deck: </span>
            {p.deck.length} card{p.deck.length !== 1 ? "s" : ""}
          </div>
        )}
        {p.handCards.length > 0 && (
          <div className="text-[11px] text-white/70">
            <span className="text-white/40">Hand: </span>
            {p.handCards.map((c, i) => (
              <span key={i}>{i > 0 ? ", " : ""}{cardName(c)}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-black/20 p-3 space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Preview</div>
      <div className="text-[11px] text-white/60 space-y-0.5">
        <div>Round {state.currentRound} · Phase {state.gamePhase} · Active: P{state.activePlayer}</div>
        <div>Initiative: P{state.initiativePlayer}{state.initiativeClaimed ? " (claimed)" : ""}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <PlayerPreview p={state.player1} label="Player 1 (You)" />
        <PlayerPreview p={state.player2} label="Player 2 (Opponent)" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  onClose: () => void;
  onSaved: (id: string) => void;
  onTest?: (data: { rawInitial?: unknown; gameState: unknown; sentinelPlayIds?: string[]; unitBuffs?: Record<string, { power: number; hp: number }> }) => void;
  initialRaw?: unknown;
  initialId?: string;
  initialMeta?: { name?: string; description?: string; infoText?: string; difficulty?: number; author?: string; inspiredBy?: string; intendedSolution?: string[]; assetPath?: string };
};

export function PuzzleBuilderPanel({ onClose, onSaved, onTest, initialRaw, initialMeta, initialId }: Props) {
  const [cards, setCards] = React.useState<CardCatalogEntry[]>([]);
  const [cardsLoading, setCardsLoading] = React.useState(true);
  const [state, setState] = React.useState<BuilderState>(initialBuilderState);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [solverResult, setSolverResult] = React.useState<SolverResult | null>(null);
  const [solverError, setSolverError] = React.useState<string | null>(null);
  const [showSolutions, setShowSolutions] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
        let gamestate: Record<string, unknown>;
        let meta = { name: "New Puzzle", description: "", infoText: "", difficulty: 1, author: "", inspiredBy: "", intendedSolution: [] as string[], assetPath: "" };
        if (json.initialGamestate !== undefined) {
          gamestate = json.initialGamestate as Record<string, unknown>;
          meta = {
            name: String(json.name ?? "New Puzzle"),
            description: String(json.description ?? ""),
            infoText: String(json.infoText ?? ""),
            difficulty: Number(json.difficulty ?? 1),
            author: String(json.author ?? ""),
            inspiredBy: String(json.inspiredBy ?? ""),
            intendedSolution: Array.isArray(json.intendedSolution) ? json.intendedSolution.map(String) : [],
            assetPath: String(json.assetPath ?? ""),
          };
        } else {
          gamestate = json;
        }
        setState(fromRaw(gamestate, meta));
        setImportError(null);
      } catch {
        setImportError("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  }

  React.useEffect(() => {
    fetch("/api/internal/card-catalog")
      .then((r) => r.json())
      .then((data: { cards: CardCatalogEntry[] }) => setCards(data.cards))
      .finally(() => setCardsLoading(false));
  }, []);

  // Initialize from provided raw initial data when opening for editing a tested puzzle
  React.useEffect(() => {
    if (initialRaw) {
      try {
        const meta = initialMeta ?? { name: "Tested Puzzle", description: "", infoText: "", difficulty: 1, author: "", inspiredBy: "", intendedSolution: [], assetPath: "" };
        setState(fromRaw(initialRaw as Record<string, unknown>, { name: String(meta.name ?? ""), description: String(meta.description ?? ""), infoText: String(meta.infoText ?? ""), difficulty: Number(meta.difficulty ?? 1), author: String(meta.author ?? ""), inspiredBy: String(meta.inspiredBy ?? ""), intendedSolution: meta.intendedSolution ?? [], assetPath: String(meta.assetPath ?? "") }));
      } catch {
        // ignore invalid initial raw
      }
    }
  }, [initialRaw]);

  function patchGlobal(delta: Partial<BuilderState>) {
    setState((s) => ({ ...s, ...delta }));
  }

  function handleSave() {
    setSaving(true);
    setSaveError(null);
    const puzzleData = {
      id: initialId ?? "",
      name: state.name.trim(),
      description: state.description.trim(),
      infoText: state.infoText,
      author: state.author?.trim() ?? "",
      inspiredBy: state.inspiredBy?.trim() ?? "",
      intendedSolution: state.intendedSolution ?? [],
      difficulty: state.difficulty,
      assetPath: normalizePuzzleAssetPath(state.assetPath),
      initialGamestate: toRaw(state),
    };
    fetch("/api/puzzles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(puzzleData),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
        return r.json() as Promise<{ id: string }>;
      })
      .then(({ id }) => onSaved(id))
      .catch((err: unknown) =>
        setSaveError(err instanceof Error ? err.message : "Save failed."),
      )
      .finally(() => setSaving(false));
  }

  async function handleTest() {
    setSaveError(null);
    setSaving(true);
    try {
      const payload = { initialGamestate: toRaw(state) };
      const res = await fetch("/api/puzzles/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Test failed");
      const data = await res.json();
      if (onTest) onTest({ rawInitial: payload.initialGamestate, name: state.name, description: state.description, infoText: state.infoText, difficulty: state.difficulty, author: state.author, inspiredBy: state.inspiredBy, intendedSolution: state.intendedSolution, assetPath: normalizePuzzleAssetPath(state.assetPath), ...data });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const doc = {
      name: state.name.trim(),
      description: state.description.trim(),
      infoText: state.infoText,
      author: state.author?.trim() ?? "",
      inspiredBy: state.inspiredBy?.trim() ?? "",
      intendedSolution: state.intendedSolution ?? [],
      difficulty: state.difficulty,
      assetPath: normalizePuzzleAssetPath(state.assetPath),
      initialGamestate: toRaw(state),
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = state.name.trim()
      ? state.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : "puzzle";
    a.download = `${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSolve() {
    setSolverResult(null);
    setSolverError(null);
    setShowSolutions(false);
    setSaving(true);
    try {
      const res = await fetch("/api/puzzles/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzle: toRaw(state) }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Solver failed");
      const data = await res.json() as SolverResult;
      setSolverResult(data);
    } catch (err) {
      setSolverError(err instanceof Error ? err.message : "Solver failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-12 z-50 bg-[rgba(5,8,20,0.88)] backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-4 mt-20 mb-12 pb-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <div className={`rounded-2xl border border-white/10 p-6 ${globalBackgroundStyle} space-y-6`}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-[0.24em] text-white">{initialId ? "Edit Puzzle" : "Build Puzzle"}</h2>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImport}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
              >
                Import JSON
              </button>
              {importError && <span className="text-xs text-rose-300">{importError}</span>}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>

          {cardsLoading ? (
            <p className="text-xs text-white/50">Loading card catalog…</p>
          ) : (
            <>
              {/* Puzzle metadata */}
              <div className="rounded-lg bg-black/20 p-4 space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Puzzle Info</div>
                <FieldRow label="Name">
                  <input
                    type="text"
                    value={state.name}
                    onChange={(e) => patchGlobal({ name: e.target.value })}
                    placeholder="Puzzle name…"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30"
                  />
                </FieldRow>
                <FieldRow label="Description">
                  <input
                    type="text"
                    value={state.description}
                    onChange={(e) => patchGlobal({ description: e.target.value })}
                    placeholder="Optional description…"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30"
                  />
                </FieldRow>
                <FieldRow label="Info Text">
                  <textarea
                    value={state.infoText}
                    onChange={(e) => patchGlobal({ infoText: e.target.value })}
                    placeholder="Setup instructions & flavor shown to the player on load…"
                    rows={4}
                    className="w-full resize-y rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30"
                  />
                </FieldRow>
                <FieldRow label="Author">
                  <input
                    type="text"
                    value={state.author ?? ""}
                    onChange={(e) => patchGlobal({ author: e.target.value })}
                    placeholder="Author name…"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30"
                  />
                </FieldRow>
                <FieldRow label="Inspired By">
                  <input
                    type="text"
                    value={state.inspiredBy ?? ""}
                    onChange={(e) => patchGlobal({ inspiredBy: e.target.value })}
                    placeholder="Optional credit…"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30"
                  />
                </FieldRow>
                <FieldRow label="Image">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={state.assetPath ?? ""}
                      onChange={(e) => patchGlobal({ assetPath: e.target.value })}
                      placeholder="filename.png — file lives in /public/assets/puzzles/"
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30"
                    />
                    <img
                      src={puzzleImageSrc(normalizePuzzleAssetPath(state.assetPath ?? ""))}
                      alt=""
                      onError={(e) => { const img = e.currentTarget; if (!img.src.endsWith(DEFAULT_PUZZLE_IMAGE)) img.src = `/assets/${DEFAULT_PUZZLE_IMAGE}`; }}
                      className="h-12 w-12 shrink-0 rounded border-2 border-white/80 bg-black/30 object-cover"
                    />
                  </div>
                </FieldRow>
                <FieldRow label="Difficulty">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const fillPct = state.difficulty >= n ? 100 : state.difficulty >= n - 0.5 ? 50 : 0;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            if (state.difficulty === n) patchGlobal({ difficulty: n - 0.5 });
                            else if (state.difficulty === n - 0.5) patchGlobal({ difficulty: n });
                            else patchGlobal({ difficulty: n });
                          }}
                          className="relative h-6 w-6 overflow-hidden rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                          <span
                            className="absolute inset-y-0 left-0 bg-primary transition-[width]"
                            style={{ width: `${fillPct}%` }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </FieldRow>
              </div>

              {/* Global state */}
              <div className="rounded-lg bg-black/20 p-4 space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Game State</div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <FieldRow label="Round">
                    <NumberInput value={state.currentRound} onChange={(v) => patchGlobal({ currentRound: v })} min={1} />
                  </FieldRow>
                  <FieldRow label="Phase">
                    <select
                      value={state.gamePhase}
                      onChange={(e) => patchGlobal({ gamePhase: e.target.value as GamePhase })}
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none"
                    >
                      <option value="ActionPhase">Action</option>
                      <option value="RegroupDraw">Regroup Draw</option>
                      <option value="RegroupResource">Regroup Resource</option>
                      <option value="RegroupReady">Regroup Ready</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="Active P.">
                    <select
                      value={state.activePlayer}
                      onChange={(e) => patchGlobal({ activePlayer: Number(e.target.value) as 1 | 2 })}
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none"
                    >
                      <option value={1}>Player 1</option>
                      <option value={2}>Player 2</option>
                    </select>
                  </FieldRow>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-white/55">Initiative:</label>
                    <select
                      value={state.initiativePlayer}
                      onChange={(e) => patchGlobal({ initiativePlayer: Number(e.target.value) as 1 | 2 })}
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none"
                    >
                      <option value={1}>Player 1</option>
                      <option value={2}>Player 2</option>
                    </select>
                  </div>
                  <Checkbox
                    checked={state.initiativeClaimed}
                    onChange={(v) => patchGlobal({ initiativeClaimed: v })}
                    label="Initiative Claimed"
                  />
                </div>
              </div>

              {/* Player sections */}
              <div className="grid sm:grid-cols-2 gap-6">
                <PlayerSection
                  label="Player 1 (You)"
                  state={state.player1}
                  cards={cards}
                  onChange={(p) => setState((s) => ({ ...s, player1: p }))}
                />
                <PlayerSection
                  label="Player 2 (Opponent)"
                  state={state.player2}
                  cards={cards}
                  onChange={(p) => setState((s) => ({ ...s, player2: p }))}
                />
              </div>

              {/* Preview */}
              <BoardPreview state={state} cards={cards} />

              {/* Intended solution */}
              <div className="rounded-lg bg-black/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Intended Solution</div>
                  <button
                    type="button"
                    onClick={() => patchGlobal({ intendedSolution: [ ...(state.intendedSolution ?? []), "" ] })}
                    className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
                  >
                    +
                  </button>
                </div>
                <div className="space-y-2">
                  {(state.intendedSolution ?? []).map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => patchGlobal({ intendedSolution: (state.intendedSolution ?? []).map((l, j) => j === i ? e.target.value : l) })}
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => patchGlobal({ intendedSolution: (state.intendedSolution ?? []).filter((_, j) => j !== i) })}
                        className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500/30 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save Puzzle"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleTest}
                  className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/20 disabled:opacity-40"
                >
                  {saving ? "Testing…" : "Test"}
                </button>
                {process.env.NODE_ENV === "development" && (
                  <>
                    <button
                      type="button"
                      onClick={handleExport}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Export JSON
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSolve}
                      className="rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500/20 disabled:opacity-40"
                    >
                      {saving ? "Checking…" : "Solvable?"}
                    </button>
                  </>
                )}
                {saveError ? <span className="text-xs text-rose-300">{saveError}</span> : null}
              </div>
              {/* Solver result (dev only) */}
              {process.env.NODE_ENV === "development" && solverError && (
                <p className="text-xs text-rose-300">✗ {solverError}</p>
              )}
              {process.env.NODE_ENV === "development" && solverResult && !solverError && (
                <div className="flex flex-col gap-1">
                  {solverResult.timedOut && (
                    <p className="text-xs text-amber-300">⚠ Solver timed out — puzzle may still be solvable</p>
                  )}
                  {solverResult.solvable ? (
                    <>
                      <p className="text-xs text-emerald-300">
                        ✓ Solvable — {solverResult.steps.length} solution(s) found
                        {" "}
                        <button
                          type="button"
                          onClick={() => setShowSolutions((v) => !v)}
                          className="underline opacity-70 hover:opacity-100"
                        >
                          {showSolutions ? "hide" : "show"}
                        </button>
                      </p>
                      {showSolutions && (
                        <div className="mt-1 flex flex-col gap-3 text-xs text-white/70">
                          {solverResult.steps.map((solution, si) => (
                            <div key={si}>
                              <p className="font-semibold text-white/50">Solution {si + 1}:</p>
                              <ol className="ml-3 list-decimal">
                                {solution.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-rose-300">✗ No solution found</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
