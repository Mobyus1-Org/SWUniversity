import React from "react";
import { globalBackgroundStyle } from "@/util/style-const";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { GamePhase } from "@/lib/engine/core-models";

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

type UnitEntry = { cardId: string; ready: boolean; damage: number };
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
  groundUnits: UnitEntry[];
  spaceUnits: UnitEntry[];
};

type BuilderState = {
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
    resources: [], handCards: [], groundUnits: [], spaceUnits: [],
  };
}

function initialBuilderState(): BuilderState {
  return {
    activePlayer: 1,
    gamePhase: "ActionPhase" as GamePhase,
    currentRound: 1,
    initiativePlayer: 2,
    initiativeClaimed: true,
    player1: emptyPlayer(),
    player2: emptyPlayer(),
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
        ready: u.ready, damage: u.damage, upgrades: [], captives: [],
      })),
      spaceArena: p.spaceUnits.map((u) => ({
        cardId: u.cardId, playId: "@", owner: playerId, controller: playerId,
        ready: u.ready, damage: u.damage, upgrades: [], captives: [],
      })),
      resources: p.resources.map((r) => ({
        cardId: r.cardId, playId: "@", owner: playerId, controller: playerId, ready: r.ready,
      })),
      discard: [],
      deck: [],
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

      {/* Ground Arena */}
      <div className="rounded-lg bg-black/20 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Ground Arena ({state.groundUnits.length})</div>
        <UnitAdder
          unitCards={unitCards}
          units={state.groundUnits}
          cards={cards}
          onAdd={(u) => patch({ groundUnits: [...state.groundUnits, u] })}
          onRemove={(i) => patch({ groundUnits: state.groundUnits.filter((_, j) => j !== i) })}
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
        />
      </div>
    </div>
  );
}

function UnitAdder({ unitCards, units, cards, onAdd, onRemove }: {
  unitCards: CardCatalogEntry[];
  units: UnitEntry[];
  cards: CardCatalogEntry[];
  onAdd: (u: UnitEntry) => void;
  onRemove: (i: number) => void;
}) {
  const [cardId, setCardId] = React.useState("");
  const [ready, setReady] = React.useState(true);
  const [damage, setDamage] = React.useState(0);

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
          onClick={() => { onAdd({ cardId, ready, damage }); setCardId(""); setDamage(0); setReady(true); }}
          className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {units.length > 0 && (
        <div className="space-y-1">
          {units.map((u, i) => (
            <div key={i} className="flex items-center justify-between rounded-md bg-black/20 px-2 py-1 text-[11px]">
              <span className="text-white/80">
                {cards.find((c) => c.cardId === u.cardId)?.label ?? u.cardId}
                {u.damage > 0 ? <span className="ml-1.5 text-rose-300">({u.damage} dmg)</span> : null}
                {!u.ready ? <span className="ml-1.5 text-white/40">[exhausted]</span> : null}
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-white/30 hover:text-rose-300"
              >×</button>
            </div>
          ))}
        </div>
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
  onSaved: (n: number) => void;
};

export function PuzzleBuilderPanel({ onClose, onSaved }: Props) {
  const [cards, setCards] = React.useState<CardCatalogEntry[]>([]);
  const [cardsLoading, setCardsLoading] = React.useState(true);
  const [state, setState] = React.useState<BuilderState>(initialBuilderState);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/internal/card-catalog")
      .then((r) => r.json())
      .then((data: { cards: CardCatalogEntry[] }) => setCards(data.cards))
      .finally(() => setCardsLoading(false));
  }, []);

  function patchGlobal(delta: Partial<BuilderState>) {
    setState((s) => ({ ...s, ...delta }));
  }

  function handleSave() {
    setSaving(true);
    setSaveError(null);
    const raw = toRaw(state);
    fetch("/api/internal/test-puzzles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raw),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
        return r.json() as Promise<{ n: number }>;
      })
      .then(({ n }) => onSaved(n))
      .catch((err: unknown) =>
        setSaveError(err instanceof Error ? err.message : "Save failed."),
      )
      .finally(() => setSaving(false));
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-12 z-50 bg-[rgba(5,8,20,0.88)] backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-4 mt-20 mb-12 pb-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <div className={`rounded-2xl border border-white/10 p-6 ${globalBackgroundStyle} space-y-6`}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-[0.24em] text-white">Build Puzzle</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              Cancel
            </button>
          </div>

          {cardsLoading ? (
            <p className="text-xs text-white/50">Loading card catalog…</p>
          ) : (
            <>
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
                {saveError ? <span className="text-xs text-rose-300">{saveError}</span> : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
