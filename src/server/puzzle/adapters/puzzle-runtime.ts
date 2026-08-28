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
import { HP_MOD, POWER_MOD } from "@/lib/engine/core-models";

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

/**
 * The per-round trackers, defaulted field by field.
 *
 * No stored puzzle carries a `roundState` — the builder does not write one — so this fallback is
 * what EVERY puzzle runs on, and a field missing here is missing in every puzzle at once. That is
 * how `cardsDrawnThisPhase` went missing: `MarkCardDrawn` then indexed `undefined` and every draw
 * effect in every puzzle died with the API's generic "Unable to process dispatch."
 *
 * The explicit return type is the guard. The previous shape was
 * `(raw.roundState as GameState["roundState"]) ?? { ...literal }`, and pre-casting the left
 * operand stops TypeScript from ever checking the literal — so omitting a newly added field
 * compiled cleanly. Written this way, a new field on the type is a compile error until it is
 * defaulted here. Per-field defaulting also repairs a partially-stored roundState rather than
 * taking it wholesale.
 */
function hydrateRoundState(raw: unknown): GameState["roundState"] {
  const stored = (raw ?? {}) as Partial<GameState["roundState"]>;
  return {
    cardsPlayedThisPhase: stored.cardsPlayedThisPhase ?? [],
    cardsPlayedThisRound: stored.cardsPlayedThisRound ?? [],
    cardsEnteredPlayThisPhase: stored.cardsEnteredPlayThisPhase ?? [],
    cardsLeftPlayThisPhase: stored.cardsLeftPlayThisPhase ?? [],
    unitsAttackedThisPhase: stored.unitsAttackedThisPhase ?? [],
    baseDamagedThisPhase: stored.baseDamagedThisPhase ?? [],
    unitsDamagedThisPhase: stored.unitsDamagedThisPhase ?? [],
    cardsDrawnThisPhase: stored.cardsDrawnThisPhase ?? { 1: 0, 2: 0 },
    lastActionWasPass: stored.lastActionWasPass ?? false,
    regroupResourcedPlayers: stored.regroupResourcedPlayers ?? [],
    forceUsedThisPhase: stored.forceUsedThisPhase ?? 0,
    ...(stored.extraActionPlayer !== undefined && { extraActionPlayer: stored.extraActionPlayer }),
    ...(stored.actingPlayer !== undefined && { actingPlayer: stored.actingPlayer }),
  };
}

export function hydratePuzzleGame(raw: RawPuzzleGameState): GameState {
  let nextId = 1;

  /**
   * Stat modifiers authored onto a unit in the builder, expanded here.
   *
   * They are stored nested under the unit rather than as top-level currentEffects because a
   * builder unit's playId is the placeholder "@" — resolvePlayId mints a FRESH id for every one,
   * so a top-level effect could never name the unit it belongs to. Collecting them as each unit is
   * hydrated is the only point where the authored buff and its final playId are both in hand.
   */
  const authoredEffects: GameState["currentEffects"] = [];

  function freshId(): string {
    return String(nextId++);
  }

  function resolvePlayId(raw: unknown): string {
    return raw === "@" || raw === undefined || raw === null
      ? freshId()
      : String(raw);
  }

  function hydrateBase(b: Record<string, unknown>): Base {
    const upgrades = (b.upgrades ?? []) as Record<string, unknown>[];
    const captives = (b.captives ?? []) as Record<string, unknown>[];
    return {
      cardId: b.cardId as string,
      epicActionUsed: Boolean(b.epicActionUsed),
      damage: Number(b.damage ?? 0),
      numUses: Number(b.numUses ?? 0),
      // Fortify upgrades and base-held captives (Arrest). Always arrays, never undefined, so
      // every consumer can iterate without a null guard.
      upgrades: upgrades.map(hydrateUpgrade),
      captives: captives.map(hydrateUnit),
    };
  }

  function hydrateLeader(l: Record<string, unknown>): Leader {
    return {
      cardId: l.cardId as string,
      epicActionUsed: Boolean(l.epicActionUsed),
      ready: l.ready !== false,
      deployed: Boolean(l.deployed),
      deployedPlayId: l.deployedPlayId as string | undefined,
      // A double-sided leader (TWI_017) can start a puzzle on its back face.
      flipped: Boolean(l.flipped),
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
    const playId = resolvePlayId(u.playId);
    // Filed under the CONTROLLER: GetCurrentEffectsForPlayer filters on controller, so a unit
    // taken with a control effect would otherwise read its buff from the wrong side.
    const controller = u.controller as PlayerId;
    const buff = u.buff as { power?: unknown; hp?: unknown } | undefined;
    if (buff) {
      const power = Number(buff.power ?? 0) || 0;
      const hp = Number(buff.hp ?? 0) || 0;
      // One-sided sentinels rather than the combined stat-mod, so an asymmetric +2/-1 works and a
      // zero half contributes nothing.
      if (power !== 0) {
        authoredEffects.push({ cardId: POWER_MOD, duration: "Phase", affectedPlayer: controller, targetPlayId: playId, value: power });
      }
      if (hp !== 0) {
        authoredEffects.push({ cardId: HP_MOD, duration: "Phase", affectedPlayer: controller, targetPlayId: playId, value: hp });
      }
    }
    return {
      cardId: u.cardId as string,
      playId,
      owner: u.owner as PlayerId,
      controller,
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
    currentEffects: [...((raw.currentEffects as GameState["currentEffects"]) ?? []), ...authoredEffects],
    currentRound: Number(raw.currentRound ?? 1),
    initiativePlayer: (raw.initiativePlayer as PlayerId) ?? 1,
    initiativeClaimed: Boolean(raw.initiativeClaimed),
    defeatedPlayers: (raw.defeatedPlayers as PlayerId[]) ?? [],
    triggerBag: (raw.triggerBag as TriggerEntry[]) ?? [],
    roundState: hydrateRoundState(raw.roundState),
  };
}
