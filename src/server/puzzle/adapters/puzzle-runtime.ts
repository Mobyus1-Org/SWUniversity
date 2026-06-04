import type { GameState, PlayerState } from "@/lib/engine/game";
import type {
  Base,
  Card,
  CardInPlay,
  DiscardedCard,
  Leader,
  PlayerId,
  Resource,
  Unit,
} from "@/lib/engine/core-models";
import type { TriggerEntry } from "@/lib/engine/trigger-types";

// ---------------------------------------------------------------------------
// Raw puzzle JSON format (stored in src/server/_test-puzzles/*.json)
// ---------------------------------------------------------------------------
// gamePhase is stored as a number (0 = ActionPhase, 1 = RegroupDraw, ...)
// playIds that equal "@" are auto-assigned during hydration.

export type RawPuzzleGameState = Record<string, unknown>;

const PHASE_MAP = [
  "ActionPhase",
  "RegroupDraw",
  "RegroupResource",
  "RegroupReady",
] as const;

// ---------------------------------------------------------------------------
// hydratePuzzleGame — converts raw JSON into a valid GameState
// ---------------------------------------------------------------------------

export function hydratePuzzleGame(raw: RawPuzzleGameState): GameState {
  let nextId = 1;

  function freshId(): string {
    return String(nextId++);
  }

  function resolvePlayId(raw: unknown): string {
    return raw === "@" || raw === undefined || raw === null
      ? freshId()
      : String(raw);
  }

  function hydrateBase(b: Record<string, unknown>): Base {
    return {
      cardId: b.cardId as string,
      epicActionUsed: Boolean(b.epicActionUsed),
      damage: Number(b.damage ?? 0),
      numUses: Number(b.numUses ?? 0),
    };
  }

  function hydrateLeader(l: Record<string, unknown>): Leader {
    return {
      cardId: l.cardId as string,
      epicActionUsed: Boolean(l.epicActionUsed),
      ready: l.ready !== false,
      deployed: Boolean(l.deployed),
      deployedPlayId: l.deployedPlayId as string | undefined,
    };
  }

  function hydrateUpgrade(u: Record<string, unknown>): CardInPlay {
    return {
      cardId: u.cardId as string,
      playId: resolvePlayId(u.playId),
      owner: u.owner as PlayerId,
      controller: u.controller as PlayerId,
    };
  }

  function hydrateUnit(u: Record<string, unknown>): Unit {
    return {
      cardId: u.cardId as string,
      playId: resolvePlayId(u.playId),
      owner: u.owner as PlayerId,
      controller: u.controller as PlayerId,
      ready: u.ready !== false,
      damage: Number(u.damage ?? 0),
      upgrades: ((u.upgrades ?? []) as Record<string, unknown>[]).map(hydrateUpgrade),
      captives: ((u.captives ?? []) as Record<string, unknown>[]).map(hydrateUnit),
      numUses: Number(u.numUses ?? 0),
      isClone: Boolean(u.isClone),
    };
  }

  function hydrateResource(r: Record<string, unknown>): Resource {
    return {
      cardId: r.cardId as string,
      playId: resolvePlayId(r.playId),
      owner: r.owner as PlayerId,
      controller: r.controller as PlayerId,
      ready: r.ready !== false,
      stolen: Boolean(r.stolen),
    };
  }

  function hydrateDiscarded(d: Record<string, unknown>): DiscardedCard {
    return {
      cardId: d.cardId as string,
      playId: resolvePlayId(d.playId),
      owner: d.owner as PlayerId,
      controller: d.controller as PlayerId,
      turnDiscarded: Number(d.turnDiscarded ?? 0),
      discardEffect: (d.discardEffect as DiscardedCard["discardEffect"]) ?? "",
    };
  }

  function hydrateCard(c: Record<string, unknown>): Card {
    return { cardId: c.cardId as string };
  }

  function hydratePlayer(p: Record<string, unknown>): PlayerState {
    return {
      base: hydrateBase(p.base as Record<string, unknown>),
      leader: hydrateLeader(p.leader as Record<string, unknown>),
      spaceArena: ((p.spaceArena ?? []) as Record<string, unknown>[]).map(hydrateUnit),
      groundArena: ((p.groundArena ?? []) as Record<string, unknown>[]).map(hydrateUnit),
      resources: ((p.resources ?? []) as Record<string, unknown>[]).map(hydrateResource),
      discard: ((p.discard ?? []) as Record<string, unknown>[]).map(hydrateDiscarded),
      deck: ((p.deck ?? []) as Record<string, unknown>[]).map(hydrateCard),
      hand: ((p.hand ?? []) as Record<string, unknown>[]).map(hydrateCard),
      supplemental: (p.supplemental as PlayerState["supplemental"]) ?? {},
    };
  }

  const phaseIndex = raw.gamePhase as number;
  const gamePhase = PHASE_MAP[phaseIndex] ?? "ActionPhase";

  // Hydrate players first so nextId reflects all assigned playIds
  const player1 = hydratePlayer(raw.player1 as Record<string, unknown>);
  const player2 = hydratePlayer(raw.player2 as Record<string, unknown>);

  return {
    activePlayer: raw.activePlayer as PlayerId,
    gamePhase,
    nextPlayId: nextId,
    player1,
    player2,
    currentEffects: (raw.currentEffects as GameState["currentEffects"]) ?? [],
    currentRound: Number(raw.currentRound ?? 1),
    initiativePlayer: (raw.initiativePlayer as PlayerId) ?? 1,
    initiativeClaimed: Boolean(raw.initiativeClaimed),
    defeatedPlayers: (raw.defeatedPlayers as PlayerId[]) ?? [],
    triggerBag: (raw.triggerBag as TriggerEntry[]) ?? [],
    roundState: (raw.roundState as GameState["roundState"]) ?? {
      cardsPlayedThisPhase: [],
      cardsPlayedThisRound: [],
      cardsEnteredPlayThisPhase: [],
      cardsLeftPlayThisPhase: [],
      unitsAttackedThisPhase: [],
    },
  };
}
