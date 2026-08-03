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
export type UnitEntry = { cardId: string; ready: boolean; damage: number; upgrades: UpgradeEntry[]; captives: string[] };
export type ResourceEntry = { cardId: string; ready: boolean };

export type PlayerBuilderState = {
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

export function emptyPlayer(): PlayerBuilderState {
  return {
    baseCardId: "", baseDamage: 0, baseEpicActionUsed: false,
    leaderCardId: "", leaderReady: true, leaderDeployed: false, leaderEpicActionUsed: false,
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
    leaderCardId: String(leader.cardId ?? ""),
    leaderReady: leader.ready !== false,
    leaderDeployed: Boolean(leader.deployed),
    leaderEpicActionUsed: Boolean(leader.epicActionUsed),
    resources: resources.map((r) => ({ cardId: String(r.cardId ?? ""), ready: r.ready !== false })),
    handCards: hand.map((h) => String((h as Record<string, unknown>).cardId ?? "")),
    deck: deck.map((d) => String(d.cardId ?? "")),
    discard: discard.map((d) => String(d.cardId ?? "")),
    groundUnits: ground.map((u) => ({
      cardId: String(u.cardId ?? ""), ready: u.ready !== false, damage: Number(u.damage ?? 0),
      upgrades: parseUpgrades(u.upgrades, playerId),
      captives: ((u.captives ?? []) as Record<string, unknown>[]).map((c) => String(c.cardId ?? "")),
    })),
    spaceUnits: space.map((u) => ({
      cardId: String(u.cardId ?? ""), ready: u.ready !== false, damage: Number(u.damage ?? 0),
      upgrades: parseUpgrades(u.upgrades, playerId),
      captives: ((u.captives ?? []) as Record<string, unknown>[]).map((c) => String(c.cardId ?? "")),
    })),
    creditTokens: Number(supplemental.creditTokens ?? 0),
    forceToken: Boolean(supplemental.forceToken),
  };
}

export function fromRaw(raw: Record<string, unknown>, meta: { name: string; description: string; infoText?: string; difficulty: number; author?: string; inspiredBy?: string; intendedSolution?: string[]; hints?: string[]; assetPath?: string }): BuilderState {
  return {
    name: meta.name,
    description: meta.description,
    infoText: meta.infoText ?? "",
    difficulty: meta.difficulty,
    author: meta.author ?? "",
    inspiredBy: meta.inspiredBy ?? "",
    intendedSolution: meta.intendedSolution ?? [],
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
      base: { cardId: p.baseCardId, damage: p.baseDamage, epicActionUsed: p.baseEpicActionUsed },
      leader: {
        cardId: p.leaderCardId,
        ready: p.leaderReady,
        // A leader sitting on a unit as a Pilot IS deployed — the state has no other spelling.
        deployed: p.leaderDeployed || hasLeaderUpgrade,
        epicActionUsed: p.leaderEpicActionUsed,
        ...(hasLeaderUpgrade && { deployedPlayId: leaderUpgradePlayId }),
      },
      groundArena: p.groundUnits.map((u) => ({
        cardId: u.cardId, playId: "@", owner: playerId, controller: playerId,
        ready: u.ready, damage: u.damage,
        upgrades: u.upgrades.map((ug) => ({
          cardId: ug.cardId,
          playId: upgradePlayId(ug),
          owner: ug.enemy ? enemyOwner : playerId,
          controller: ug.enemy ? enemyOwner : playerId,
        })),
        captives: u.captives.map((cardId) => ({ cardId, playId: "@", owner: captiveOwner, controller: captiveOwner })),
      })),
      spaceArena: p.spaceUnits.map((u) => ({
        cardId: u.cardId, playId: "@", owner: playerId, controller: playerId,
        ready: u.ready, damage: u.damage,
        upgrades: u.upgrades.map((ug) => ({
          cardId: ug.cardId,
          playId: upgradePlayId(ug),
          owner: ug.enemy ? enemyOwner : playerId,
          controller: ug.enemy ? enemyOwner : playerId,
        })),
        captives: u.captives.map((cardId) => ({ cardId, playId: "@", owner: captiveOwner, controller: captiveOwner })),
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