import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { GamePhase } from "@/lib/engine/core-models";
import { CardType } from "@/server/engine/card-db/generated";

// ---------------------------------------------------------------------------
// Pure puzzle-builder state: the shapes the builder UI edits, and the two
// conversions between that state and the raw puzzle JSON that gets stored.
//
// Deliberately React-free and separate from PuzzleBuilderPanel.tsx so it can be
// unit-tested directly (and so the panel file exports only components).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Builder state types
// ---------------------------------------------------------------------------

/**
 * An upgrade sitting on a unit. `enemy` is relative to the unit's CONTROLLER: an enemy upgrade
 * (Frozen in Carbonite, Traitorous) is owned and controlled by that unit's opponent.
 */
export type UpgradeEntry = { cardId: string; enemy?: boolean };

/**
 * A unit in an arena. The arena it sits in IS its controller; `owner` is tracked separately so a
 * unit taken with a control effect (Traitorous, No Glory Only Results) can be authored — the engine
 * sends a defeated unit to its OWNER's discard and a bounced one to its OWNER's hand.
 *
 * Absolute (1 | 2), not an `enemy` flag like UpgradeEntry: the stored JSON holds an absolute owner,
 * and a relative flag is what made upgrade ownership fail to round-trip. Undefined — the common
 * case — means owned by the player whose arena this is.
 */
/**
 * A unit held captive by another. Capture used to be enemy-only (CR 8.33), so the owner could be
 * inferred as "the guard's opponent" — but cards like Escape Pod (SEC_056) and Bothan-5 (ASH_128)
 * capture FRIENDLY units, so it has to be stored.
 *
 * `friendly` is the exception rather than the default, which keeps the common case absent from the
 * JSON and lets existing puzzles round-trip byte-identical.
 */
export type CaptiveEntry = { cardId: string; friendly?: boolean };

/**
 * A temporary stat modifier authored onto a unit — the board state a card like Overwhelming
 * Barrage or Luke's –6/–6 would have left behind.
 *
 * Deliberately NOT attributed to a source card. The engine's own stat modifiers are already stored
 * under generic sentinels (`power-mod` / `hp-mod`), and a real cardId in `currentEffects` is
 * *interpreted* — CurrentPower has cases for SOR_103, SOR_168 and others, and SOR_138 means "loses
 * all abilities" — so authoring one would silently do more than the numbers say.
 *
 * Power and HP are independent, so an asymmetric +2/–1 is expressible; 0 means no modifier on that
 * half and emits nothing.
 */
export type BuffEntry = { power: number; hp: number };

export type UnitEntry = { cardId: string; ready: boolean; damage: number; upgrades: UpgradeEntry[]; captives: CaptiveEntry[]; owner?: 1 | 2; buff?: BuffEntry };
export type ResourceEntry = { cardId: string; ready: boolean };

export type PlayerBuilderState = {
  baseCardId: string;
  baseDamage: number;
  baseEpicActionUsed: boolean;
  /** Fortify upgrades attached to the base (HMW_081, HMW_171). */
  baseUpgrades: UpgradeEntry[];
  /** Units the base is holding captive (SEC_195 Arrest). */
  baseCaptives: CaptiveEntry[];
  leaderCardId: string;
  leaderReady: boolean;
  leaderDeployed: boolean;
  leaderEpicActionUsed: boolean;
  /** A double-sided leader (TWI_017) starting the puzzle on its BACK face. */
  leaderFlipped: boolean;
  resources: ResourceEntry[];
  handCards: string[];
  deck: string[];
  discard: string[];
  groundUnits: UnitEntry[];
  spaceUnits: UnitEntry[];
  creditTokens: number;
  forceToken: boolean;
};

export type BuilderState = {
  name: string;
  description: string;
  infoText: string;
  difficulty: number;
  author: string;
  inspiredBy?: string;
  intendedSolution: string[];
  /** Why the puzzle is lost on reaching regroup (see the regroup-failure spec). Defaults to
   *  {@link DEFAULT_ALTERNATE_FAIL_EXPLANATION}; author a real one when surviving the regroup
   *  draw is an intended way to lose the puzzle. */
  alternateFailExplanation?: string;
  hints: string[];
  assetPath: string;
  activePlayer: 1 | 2;
  gamePhase: GamePhase;
  currentRound: number;
  initiativePlayer: 1 | 2;
  initiativeClaimed: boolean;
  player1: PlayerBuilderState;
  player2: PlayerBuilderState;
};

/**
 * Returns a copy of `list` with the item at `from` shifted by `delta` positions.
 *
 * Board order is meaningful — it is the arena order a solver sees, the hand order they click, and
 * the `groundArena[0]` style indices that authored solutions and tests are written against — so
 * the builder needs to reorder in place rather than forcing a delete-and-re-add (which also loses
 * a unit's upgrades, captives and damage).
 *
 * A move that would run off either end returns the list unchanged, so the caller can wire up the
 * buttons without also having to guard the edges.
 */
export function moveItem<T>(list: T[], from: number, delta: number): T[] {
  const to = from + delta;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Fallback copy for a puzzle that can be lost by surviving to regroup but has no authored
 * explanation. Reaching regroup alive is nearly always an unintended solution rather than a
 * designed failure, so the generic wording asks the player to report it instead of leaving them
 * (or the app) stuck.
 */
export const DEFAULT_ALTERNATE_FAIL_EXPLANATION =
  "You somehow survived the Regroup phase unintentionally. Please report this solution on our Discord.";

export function emptyPlayer(): PlayerBuilderState {
  return {
    baseCardId: "", baseDamage: 0, baseEpicActionUsed: false, baseUpgrades: [], baseCaptives: [],
    leaderCardId: "", leaderReady: true, leaderDeployed: false, leaderEpicActionUsed: false, leaderFlipped: false,
    resources: [], handCards: [], deck: [], discard: [], groundUnits: [], spaceUnits: [],
    creditTokens: 0, forceToken: false,
  };
}

export function initialBuilderState(): BuilderState {
  return {
    name: "",
    description: "",
    infoText:
      "Your opponent has claimed the Initiative.\nYou have zero cards remaining in your deck.\nWin the game.",
    difficulty: 1,
    author: "",
    inspiredBy: "",
    intendedSolution: [],
    alternateFailExplanation: DEFAULT_ALTERNATE_FAIL_EXPLANATION,
    hints: [],
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

/** Rebuilds the builder's `enemy` flag from stored ownership, relative to the unit's player. */
function parseUpgrades(raw: unknown, playerId: 1 | 2): UpgradeEntry[] {
  return ((raw ?? []) as Record<string, unknown>[]).map((ug) => ({
    cardId: String(ug.cardId ?? ""),
    enemy: Number(ug.controller ?? playerId) !== playerId,
  }));
}

/**
 * Rebuilds one arena unit. A stored owner equal to the arena's player collapses back to undefined,
 * so importing and re-exporting an ordinary puzzle leaves the JSON untouched.
 */
function parseUnit(u: Record<string, unknown>, playerId: 1 | 2): UnitEntry {
  const owner = Number(u.owner ?? playerId) === 2 ? 2 : 1;
  return {
    cardId: String(u.cardId ?? ""), ready: u.ready !== false, damage: Number(u.damage ?? 0),
    upgrades: parseUpgrades(u.upgrades, playerId),
    captives: ((u.captives ?? []) as Record<string, unknown>[]).map((c) => ({
      cardId: String(c.cardId ?? ""),
      // Absent owner means the old enemy-only assumption, which is the default either way.
      ...(Number(c.owner ?? (playerId === 1 ? 2 : 1)) === playerId && { friendly: true as const }),
    })),
    ...(owner !== playerId && { owner }),
    ...(parseBuff(u.buff) && { buff: parseBuff(u.buff)! }),
  };
}

/** Reads a stored buff, treating a missing or all-zero one as no buff at all. */
function parseBuff(raw: unknown): BuffEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const power = Number(b.power ?? 0) || 0;
  const hp = Number(b.hp ?? 0) || 0;
  return power === 0 && hp === 0 ? null : { power, hp };
}

function parseRawPlayer(p: Record<string, unknown>, playerId: 1 | 2): PlayerBuilderState {
  const base = (p.base ?? {}) as Record<string, unknown>;
  const leader = (p.leader ?? {}) as Record<string, unknown>;
  const ground = (p.groundArena ?? []) as Record<string, unknown>[];
  const space = (p.spaceArena ?? []) as Record<string, unknown>[];
  const resources = (p.resources ?? []) as Record<string, unknown>[];
  const hand = (p.hand ?? []) as Record<string, unknown>[];
  const deck = (p.deck ?? []) as Record<string, unknown>[];
  const discard = (p.discard ?? []) as Record<string, unknown>[];
  const supplemental = (p.supplemental ?? {}) as Record<string, unknown>;
  return {
    baseCardId: String(base.cardId ?? ""),
    baseDamage: Number(base.damage ?? 0),
    baseEpicActionUsed: Boolean(base.epicActionUsed),
    baseUpgrades: parseUpgrades(base.upgrades, playerId),
    baseCaptives: ((base.captives ?? []) as Record<string, unknown>[]).map((c) => ({
      cardId: String(c.cardId ?? ""),
      ...(Number(c.owner ?? (playerId === 1 ? 2 : 1)) === playerId && { friendly: true as const }),
    })),
    leaderCardId: String(leader.cardId ?? ""),
    leaderReady: leader.ready !== false,
    leaderDeployed: Boolean(leader.deployed),
    leaderEpicActionUsed: Boolean(leader.epicActionUsed),
    leaderFlipped: Boolean(leader.flipped),
    resources: resources.map((r) => ({ cardId: String(r.cardId ?? ""), ready: r.ready !== false })),
    handCards: hand.map((h) => String((h as Record<string, unknown>).cardId ?? "")),
    deck: deck.map((d) => String(d.cardId ?? "")),
    discard: discard.map((d) => String(d.cardId ?? "")),
    groundUnits: ground.map((u) => parseUnit(u, playerId)),
    spaceUnits: space.map((u) => parseUnit(u, playerId)),
    creditTokens: Number(supplemental.creditTokens ?? 0),
    forceToken: Boolean(supplemental.forceToken),
  };
}

export function fromRaw(raw: Record<string, unknown>, meta: { name: string; description: string; infoText?: string; difficulty: number; author?: string; inspiredBy?: string; intendedSolution?: string[]; hints?: string[]; alternateFailExplanation?: string; assetPath?: string }): BuilderState {
  return {
    name: meta.name,
    description: meta.description,
    infoText: meta.infoText ?? "",
    difficulty: meta.difficulty,
    author: meta.author ?? "",
    inspiredBy: meta.inspiredBy ?? "",
    intendedSolution: meta.intendedSolution ?? [],
    // Puzzles authored before the field existed (or saved empty) open with the default rather than
    // a blank box, so re-saving an old puzzle in the editor fills the gap.
    alternateFailExplanation: meta.alternateFailExplanation?.trim()
      ? meta.alternateFailExplanation
      : DEFAULT_ALTERNATE_FAIL_EXPLANATION,
    hints: meta.hints ?? [],
    assetPath: meta.assetPath ?? "",
    activePlayer: Number(raw.activePlayer) === 2 ? 2 : 1,
    gamePhase: resolvePhase(raw.gamePhase),
    currentRound: Number(raw.currentRound ?? 1),
    initiativePlayer: Number(raw.initiativePlayer) === 2 ? 2 : 1,
    initiativeClaimed: raw.initiativeClaimed !== false,
    player1: parseRawPlayer((raw.player1 ?? {}) as Record<string, unknown>, 1),
    player2: parseRawPlayer((raw.player2 ?? {}) as Record<string, unknown>, 2),
  };
}

// ---------------------------------------------------------------------------
// Convert builder state → RawGameState
// ---------------------------------------------------------------------------

export function toRaw(s: BuilderState): RawPuzzleGameState {
  function mapPlayer(p: PlayerBuilderState, playerId: 1 | 2) {
    // A unit can only capture an ENEMY non-leader unit (CR 8.33), so anything held captive by
    // this player's unit is owned by their opponent — that is where it returns when rescued.
    const captiveOwner = playerId === 1 ? 2 : 1;
    // An upgrade marked `enemy` belongs to the opposing player even though it sits on this
    // player's unit — the same asymmetry captives already have, in the other direction.
    const enemyOwner = playerId === 1 ? 2 : 1;
    // A leader attached as a Pilot upgrade needs leader.deployedPlayId to point at that exact
    // upgrade. Hydration assigns ids only to "@" placeholders and counts up from "1", so a
    // non-numeric literal is both stable and collision-free.
    const leaderUpgradePlayId = `L${playerId}`;
    const hasLeaderUpgrade = [...p.groundUnits, ...p.spaceUnits]
      .some((u) => u.upgrades.some((ug) => CardType(ug.cardId) === "Leader"));

    const upgradePlayId = (ug: UpgradeEntry) =>
      CardType(ug.cardId) === "Leader" ? leaderUpgradePlayId : "@";
    return {
      base: {
        cardId: p.baseCardId,
        damage: p.baseDamage,
        epicActionUsed: p.baseEpicActionUsed,
        // Emitted only when present, so an ordinary base serialises exactly as it always did.
        ...((p.baseUpgrades ?? []).length > 0 && {
          upgrades: (p.baseUpgrades ?? []).map((ug) => ({
            cardId: ug.cardId, playId: "@",
            owner: ug.enemy ? enemyOwner : playerId,
            controller: ug.enemy ? enemyOwner : playerId,
          })),
        }),
        ...((p.baseCaptives ?? []).length > 0 && {
          captives: (p.baseCaptives ?? []).map((c) => ({
            cardId: c.cardId, playId: "@",
            // A captive is owned by whoever it was taken FROM — the enemy unless marked friendly.
            owner: c.friendly ? playerId : captiveOwner,
            controller: c.friendly ? playerId : captiveOwner,
            ready: true, damage: 0, upgrades: [], captives: [],
          })),
        }),
      },
      leader: {
        cardId: p.leaderCardId,
        ready: p.leaderReady,
        // A leader sitting on a unit as a Pilot IS deployed — the state has no other spelling.
        deployed: p.leaderDeployed || hasLeaderUpgrade,
        epicActionUsed: p.leaderEpicActionUsed,
        ...(p.leaderFlipped && { flipped: true }),
        ...(hasLeaderUpgrade && { deployedPlayId: leaderUpgradePlayId }),
      },
      groundArena: p.groundUnits.map((u) => ({
        // The arena is the controller; the owner is overridable (control effects).
        cardId: u.cardId, playId: "@", owner: u.owner ?? playerId, controller: playerId,
        ready: u.ready, damage: u.damage,
        upgrades: u.upgrades.map((ug) => ({
          cardId: ug.cardId,
          playId: upgradePlayId(ug),
          owner: ug.enemy ? enemyOwner : playerId,
          controller: ug.enemy ? enemyOwner : playerId,
        })),
        captives: u.captives.map((c) => {
          const owner = c.friendly ? playerId : captiveOwner;
          return { cardId: c.cardId, playId: "@", owner, controller: owner };
        }),
        // Expanded into currentEffects at hydration, where the unit's real playId is known.
        ...(u.buff && (u.buff.power !== 0 || u.buff.hp !== 0) && { buff: { ...u.buff } }),
      })),
      spaceArena: p.spaceUnits.map((u) => ({
        // The arena is the controller; the owner is overridable (control effects).
        cardId: u.cardId, playId: "@", owner: u.owner ?? playerId, controller: playerId,
        ready: u.ready, damage: u.damage,
        upgrades: u.upgrades.map((ug) => ({
          cardId: ug.cardId,
          playId: upgradePlayId(ug),
          owner: ug.enemy ? enemyOwner : playerId,
          controller: ug.enemy ? enemyOwner : playerId,
        })),
        captives: u.captives.map((c) => {
          const owner = c.friendly ? playerId : captiveOwner;
          return { cardId: c.cardId, playId: "@", owner, controller: owner };
        }),
        // Expanded into currentEffects at hydration, where the unit's real playId is known.
        ...(u.buff && (u.buff.power !== 0 || u.buff.hp !== 0) && { buff: { ...u.buff } }),
      })),
      resources: p.resources.map((r) => ({
        cardId: r.cardId, playId: "@", owner: playerId, controller: playerId, ready: r.ready,
      })),
      discard: p.discard.map((cardId) => ({
        cardId, playId: "@", owner: playerId, controller: playerId,
      })),
      deck: p.deck.map((cardId) => ({ cardId })),
      hand: p.handCards.map((cardId) => ({ cardId })),
      supplemental: { creditTokens: p.creditTokens, forceToken: p.forceToken },
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