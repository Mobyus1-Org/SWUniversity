/**
 * Phase 1 bridge: converts the client-facing PuzzleRuntime into the server
 * engine's Game singleton so full keyword logic (HasSentinel, HasSaboteur, …)
 * can evaluate correctly. Computes a PuzzleUiHints object that the API
 * attaches to every response so the client needs zero game logic.
 *
 * The singleton is set up immediately before any query and torn down in a
 * finally block, so concurrent requests don't interfere.
 */

import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { SetGame } from "@/server/engine/core-functions";
import { CardArena, CardAspects, CardCost } from "@/server/engine/card-db/generated";
import { DiscardEffect, EffectDuration, GamePhase, PlayerId } from "@/server/engine/core-models";
import type { Game, GameState } from "@/server/engine/game";
import { Unit } from "@/server/engine/unit";
import type { PuzzleGameState, PuzzleRuntime, PuzzleUnit } from "@/lib/puzzles/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PuzzleUiHints = {
  /** Unit playIds the player may click in the current game state. */
  selectablePlayIds: string[];
  /** Player numbers (1 and/or 2) whose base tile may be clicked. */
  selectableBaseForPlayer: number[];
  /** Whether the undeployed leader card zone is clickable. */
  canClickLeader: boolean;
  /** Hand card indices that are affordable and legally playable right now. */
  selectableHandIndices: number[];
  /** playIds of units that currently have the Sentinel keyword active. */
  sentinelPlayIds: string[];
  /** Human-readable prompt / status text to display in the UI. */
  promptTitle: string;
  /** Buttons to render for the active prompt (choose-option flow). */
  promptOptions: Array<{ id: string; label: string; disabled?: boolean }>;
  /** Full list of legal player actions for the action bar. */
  legalActions: Array<{
    type: string;
    handIndex?: number;
    cardId?: string;
    playId?: string;
    player?: number;
  }>;
};

// ---------------------------------------------------------------------------
// PlayerId bridge (enum values equal 1 and 2 at runtime — cast is safe)
// ---------------------------------------------------------------------------

function toServerId(id: 1 | 2): PlayerId {
  return id as unknown as PlayerId;
}

// ---------------------------------------------------------------------------
// PuzzleUnit → Unit class instance
// ---------------------------------------------------------------------------

function bridgeUnit(pu: PuzzleUnit): Unit {
  const unit = new Unit(pu.cardId, pu.playId, toServerId(pu.controller));
  unit.owner = toServerId(pu.owner);
  unit.ready = pu.ready;
  unit.damage = pu.damage;
  unit.upgrades = pu.upgrades.map((u) => ({
    cardId: u.cardId,
    playId: u.playId,
    owner: toServerId(u.owner),
    controller: toServerId(u.controller),
  }));
  unit.captives = pu.captives.map((c) => bridgeUnit(c));
  return unit;
}

// ---------------------------------------------------------------------------
// PuzzleGameState → GameState
// ---------------------------------------------------------------------------

function bridgeGameState(ps: PuzzleGameState): GameState {
  const mapPlayer = (p: typeof ps.player1) => ({
    base: p.base,
    leader: p.leader,
    spaceArena: p.spaceArena.map(bridgeUnit),
    groundArena: p.groundArena.map(bridgeUnit),
    resources: p.resources.map((r) => ({
      cardId: r.cardId,
      playId: r.playId,
      owner: toServerId(r.owner),
      controller: toServerId(r.controller),
      ready: r.ready,
      stolen: false as const,
    })),
    discard: p.discard.map((d) => ({
      cardId: d.cardId,
      playId: d.playId,
      owner: toServerId(d.owner),
      controller: toServerId(d.controller),
      turnDiscarded: d.turnDiscarded ?? 0,
      discardEffect: d.discardEffect === "OTTFREE" ? DiscardEffect.OTTFREE : DiscardEffect.TTFREE,
    })),
    deck: p.deck,
    hand: p.hand,
    supplemental: p.supplemental,
  });

  return {
    activePlayer: ps.activePlayer as unknown as PlayerId,
    defeatedPlayers: (ps.defeatedPlayers ?? []) as unknown as PlayerId[],
    gamePhase: ps.gamePhase as unknown as GamePhase,
    player1: mapPlayer(ps.player1),
    player2: mapPlayer(ps.player2),
    currentEffects: ps.currentEffects.map((e) => ({
      cardId: e.cardId,
      duration: (e.duration ?? EffectDuration.Phase) as EffectDuration,
      affectedPlayer: (e.affectedPlayer ?? PlayerId.Player1) as PlayerId,
      targetPlayId: e.targetPlayId,
    })),
    currentRound: ps.currentRound,
    initiativePlayer: ps.initiativePlayer as unknown as PlayerId,
    initiativeClaimed: ps.initiativeClaimed,
    roundState: {
      cardsPlayedThisPhase: [],
      cardsDefeatedThisPhase: [],
      unitsAttackedThisPhase: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton lifecycle helper
// ---------------------------------------------------------------------------

export function withPuzzleGame<T>(ps: PuzzleGameState, fn: () => T): T {
  const game: Game = {
    currentGameState: bridgeGameState(ps),
    gameStateHistory: [],
    gameLog: [],
  };
  SetGame(game);
  try {
    return fn();
  } finally {
    SetGame(null);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (no singleton needed)
// ---------------------------------------------------------------------------

function splitCsv(value: string | undefined): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function cardAspectPenalty(ps: PuzzleGameState, player: 1 | 2, cardId: string): number {
  const p = player === 1 ? ps.player1 : ps.player2;
  const provided = [
    ...splitCsv(CardAspects(p.base.cardId)),
    ...splitCsv(CardAspects(p.leader.cardId)),
  ];
  const remaining = new Map<string, number>();
  for (const a of provided) {
    remaining.set(a, (remaining.get(a) ?? 0) + 1);
  }
  let penalty = 0;
  for (const a of splitCsv(CardAspects(cardId))) {
    const count = remaining.get(a) ?? 0;
    if (count > 0) {
      remaining.set(a, count - 1);
    } else {
      penalty += 2;
    }
  }
  return penalty;
}

function effectiveCardCost(ps: PuzzleGameState, player: 1 | 2, cardId: string): number {
  return (CardCost(cardId) ?? 0) + cardAspectPenalty(ps, player, cardId);
}

function readyResourceCount(ps: PuzzleGameState, player: 1 | 2): number {
  return (player === 1 ? ps.player1 : ps.player2).resources.filter((r) => r.ready).length;
}

// ---------------------------------------------------------------------------
// Sentinel computation (requires singleton to be active)
// ---------------------------------------------------------------------------

function hasSentinelSafe(cardId: string, playId: string, controller: 1 | 2): boolean {
  try {
    return HasSentinel(cardId, playId, toServerId(controller));
  } catch {
    return false;
  }
}

function computeSentinelPlayIds(ps: PuzzleGameState): string[] {
  return [
    ...ps.player1.groundArena,
    ...ps.player1.spaceArena,
    ...ps.player2.groundArena,
    ...ps.player2.spaceArena,
  ]
    .filter((u) => hasSentinelSafe(u.cardId, u.playId, u.controller))
    .map((u) => u.playId);
}

// ---------------------------------------------------------------------------
// Selectable play IDs (requires singleton for sentinel checks in attack-target)
// ---------------------------------------------------------------------------

function computeSelectables(runtime: PuzzleRuntime): {
  selectablePlayIds: string[];
  selectableBaseForPlayer: number[];
  canClickLeader: boolean;
  selectableHandIndices: number[];
} {
  const { game, prompt, status } = runtime;
  const empty = {
    selectablePlayIds: [],
    selectableBaseForPlayer: [],
    canClickLeader: false,
    selectableHandIndices: [],
  };

  if (status !== "playing") return empty;

  const p1 = game.player1;

  if (!prompt) {
    const readyUnits = [...p1.groundArena, ...p1.spaceArena].filter((u) => u.ready);
    const readyRsrc = readyResourceCount(game, 1);
    const selectableHandIndices = p1.hand
      .map((card, i) => ({ card, i }))
      .filter(({ card }) => effectiveCardCost(game, 1, card.cardId) <= readyRsrc)
      .map(({ i }) => i);

    const leader = p1.leader;
    const canUseAbility = !leader.deployed && leader.ready;
    const leaderDeployCost = effectiveCardCost(game, 1, leader.cardId);
    const canDeploy = !leader.deployed && !leader.epicActionUsed && readyRsrc >= leaderDeployCost;

    return {
      selectablePlayIds: readyUnits.map((u) => u.playId),
      selectableBaseForPlayer: [],
      canClickLeader: canUseAbility || canDeploy,
      selectableHandIndices,
    };
  }

  if (prompt.kind === "hammerhead-target") {
    const all = [
      ...p1.groundArena,
      ...p1.spaceArena,
      ...game.player2.groundArena,
      ...game.player2.spaceArena,
    ];
    return {
      selectablePlayIds: all.map((u) => u.playId),
      selectableBaseForPlayer: [],
      canClickLeader: false,
      selectableHandIndices: [],
    };
  }

  if (prompt.kind === "attack-attacker") {
    const playIds = [...p1.groundArena, ...p1.spaceArena]
      .filter((u) => u.ready && u.playId !== prompt.mustBeDifferentFrom)
      .map((u) => u.playId);
    return { selectablePlayIds: playIds, selectableBaseForPlayer: [], canClickLeader: false, selectableHandIndices: [] };
  }

  if (prompt.kind === "attack-target") {
    const allUnits = [
      ...p1.groundArena,
      ...p1.spaceArena,
      ...game.player2.groundArena,
      ...game.player2.spaceArena,
    ];
    const attacker = allUnits.find((u) => u.playId === prompt.attackerPlayId);
    if (!attacker) return empty;

    const arena = (CardArena(attacker.cardId) ?? "Ground") as "Ground" | "Space";
    const defPlayer: 1 | 2 = attacker.controller === 1 ? 2 : 1;
    const defState = defPlayer === 1 ? p1 : game.player2;
    const arenaUnits = arena === "Space" ? defState.spaceArena : defState.groundArena;

    // Use real HasSentinel — singleton is active inside withPuzzleGame
    const sentinels = arenaUnits.filter((u) => hasSentinelSafe(u.cardId, u.playId, u.controller));

    if (sentinels.length > 0 && !prompt.saboteur) {
      return {
        selectablePlayIds: sentinels.map((u) => u.playId),
        selectableBaseForPlayer: [],
        canClickLeader: false,
        selectableHandIndices: [],
      };
    }

    return {
      selectablePlayIds: arenaUnits.map((u) => u.playId),
      selectableBaseForPlayer: [defPlayer],
      canClickLeader: false,
      selectableHandIndices: [],
    };
  }

  // leader-choice, k2so-choice: only buttons, no unit/base clicks
  return empty;
}

// ---------------------------------------------------------------------------
// Prompt option buttons
// ---------------------------------------------------------------------------

function computePromptOptions(
  runtime: PuzzleRuntime,
): Array<{ id: string; label: string; disabled?: boolean }> {
  const { prompt, game } = runtime;
  if (!prompt) return [];

  if (prompt.kind === "leader-choice") {
    return prompt.options.map((option) => ({
      id: option,
      label: option === "ability" ? "Use Action Ability" : "Deploy Leader",
    }));
  }

  if (prompt.kind === "hammerhead-target") {
    return [{ id: "skip", label: "Skip" }];
  }

  if (prompt.kind === "k2so-choice") {
    const targetHand = prompt.targetPlayer === 1 ? game.player1.hand : game.player2.hand;
    return [
      { id: "base-damage", label: "Deal 3 damage to enemy base" },
      { id: "discard-card", label: "Enemy discards a card", disabled: targetHand.length === 0 },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Legal actions for the action bar
// ---------------------------------------------------------------------------

function computeLegalActions(
  runtime: PuzzleRuntime,
  selectablePlayIds: string[],
  selectableHandIndices: number[],
  canClickLeader: boolean,
): PuzzleUiHints["legalActions"] {
  const { game, prompt, status, history } = runtime;
  const actions: PuzzleUiHints["legalActions"] = [];

  if (status !== "playing") {
    actions.push({ type: "reset" });
    return actions;
  }

  if (!prompt) {
    for (const i of selectableHandIndices) {
      const card = game.player1.hand[i];
      if (card) actions.push({ type: "click-hand", handIndex: i, cardId: card.cardId });
    }
    // Only include player 1 units in the action bar (not attack targets)
    const p1PlayIds = new Set([
      ...game.player1.groundArena.map((u) => u.playId),
      ...game.player1.spaceArena.map((u) => u.playId),
    ]);
    for (const playId of selectablePlayIds) {
      if (!p1PlayIds.has(playId)) continue;
      const unit =
        game.player1.groundArena.find((u) => u.playId === playId) ??
        game.player1.spaceArena.find((u) => u.playId === playId);
      if (unit) actions.push({ type: "click-unit", playId, cardId: unit.cardId });
    }
    if (canClickLeader) {
      actions.push({ type: "click-leader", player: 1 });
    }
    if (!game.initiativeClaimed) {
      actions.push({ type: "take-initiative" });
    }
    actions.push({ type: "pass" });
  }

  if (history.length > 0) {
    actions.push({ type: "undo" });
  }
  actions.push({ type: "reset" });
  return actions;
}

// ---------------------------------------------------------------------------
// Status/prompt title
// ---------------------------------------------------------------------------

function formatPromptTitle(runtime: PuzzleRuntime): string {
  if (runtime.status === "won") return "Puzzle complete!";
  if (runtime.status === "lost") return "Puzzle failed.";
  if (runtime.status === "draw") return "Puzzle ended in a draw.";
  return (
    runtime.prompt?.title ??
    "Choose an action: play a hand card, use your leader, or attack with a ready unit."
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function computePuzzleUiHints(runtime: PuzzleRuntime): PuzzleUiHints {
  return withPuzzleGame(runtime.game, () => {
    const sentinelPlayIds = computeSentinelPlayIds(runtime.game);
    const { selectablePlayIds, selectableBaseForPlayer, canClickLeader, selectableHandIndices } =
      computeSelectables(runtime);

    return {
      selectablePlayIds,
      selectableBaseForPlayer,
      canClickLeader,
      selectableHandIndices,
      sentinelPlayIds,
      promptTitle: formatPromptTitle(runtime),
      promptOptions: computePromptOptions(runtime),
      legalActions: computeLegalActions(
        runtime,
        selectablePlayIds,
        selectableHandIndices,
        canClickLeader,
      ),
    };
  });
}
