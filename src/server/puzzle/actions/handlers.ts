/**
 * Phase 2 — server-side puzzle action handlers.
 *
 * Each `handle*` function maps directly to the corresponding private function
 * from src/lib/puzzles/engine.ts, but lives here so it runs inside the
 * server engine and can reach real keyword implementations (HasSentinel, etc.)
 * via the SetGame singleton.
 */

import { CardTitle } from "@/server/engine/card-db/generated";
import { createPuzzleRuntime } from "@/server/puzzle/adapters/puzzle-runtime";
import type { PuzzleIntent, PuzzleRuntime, PlayerId } from "@/lib/puzzles/types";

import {
  CardType,
  addUnitToArena,
  canAffordCard,
  canLeaderDeploy,
  canLeaderUseAbility,
  checkGameEnd,
  cloneGame,
  dealBaseDamage,
  defeatUnit,
  drawCards,
  exhaustResources,
  getAllUnits,
  getAttackTargets,
  getCardPlayCost,
  getHandCard,
  getPlayerState,
  getUnitByPlayId,
  getUnitCurrentHp,
  hasTrait,
  logMessage,
  pushPlayedEventToDiscard,
  removeHandCard,
  resolveAttack,
  withSnapshot,
} from "./shared";

// ---------------------------------------------------------------------------
// Leader helpers (internal to this module)
// ---------------------------------------------------------------------------

function performLeaderAbility(runtime: PuzzleRuntime): PuzzleRuntime {
  if (!canLeaderUseAbility(runtime.game, 1)) {
    return runtime;
  }

  const next = withSnapshot(runtime);
  next.game.player1.leader.ready = false;
  next.prompt = null;
  dealBaseDamage(next.game, 1, 1);
  dealBaseDamage(next.game, 2, 1);
  logMessage(next, "Sabine Wren used her action ability to deal 1 damage to each base.");
  checkGameEnd(next);
  return next;
}

function performLeaderDeploy(runtime: PuzzleRuntime): PuzzleRuntime {
  if (!canLeaderDeploy(runtime.game, 1)) {
    return runtime;
  }

  const next = withSnapshot(runtime);
  const leader = next.game.player1.leader;
  leader.epicActionUsed = true;
  leader.deployed = true;
  next.prompt = null;
  const unit = addUnitToArena(next.game, 1, leader.cardId, true, true);
  leader.deployedPlayId = unit.playId;
  logMessage(next, "Sabine Wren deployed to the ground arena.");
  checkGameEnd(next);
  return next;
}

// ---------------------------------------------------------------------------
// handlePlayCard
// ---------------------------------------------------------------------------

export function handlePlayCard(runtime: PuzzleRuntime, handIndex: number): PuzzleRuntime {
  const card = getHandCard(runtime.game, handIndex);
  if (!card || !canAffordCard(runtime.game, 1, card.cardId)) {
    return runtime;
  }

  const next = withSnapshot(runtime);
  const cost = getCardPlayCost(next.game, 1, card.cardId);
  exhaustResources(next.game, 1, cost);
  removeHandCard(next.game, handIndex);
  logMessage(next, `Player 1 played ${CardTitle(card.cardId) ?? card.cardId}.`);

  const cardType = CardType(card.cardId);
  if (cardType === "Unit") {
    const unit = addUnitToArena(next.game, 1, card.cardId, false);

    if (card.cardId === "SHD_160") {
      dealBaseDamage(next.game, 1, 1);
      dealBaseDamage(next.game, 2, 1);
      logMessage(next, "Reckless Gunslinger dealt 1 damage to each base.");
    }

    if (card.cardId === "JTL_153") {
      const allUnits = getAllUnits(next.game);
      if (allUnits.length > 0) {
        next.prompt = {
          kind: "hammerhead-target",
          title: `Rebellious Hammerhead: choose a unit to deal ${getPlayerState(next.game, 1).hand.length} damage to, or skip.`,
          unitPlayId: unit.playId,
          damage: getPlayerState(next.game, 1).hand.length,
        };
        checkGameEnd(next);
        return next;
      }
    }

    next.prompt = null;
    checkGameEnd(next);
    return next;
  }

  pushPlayedEventToDiscard(next.game, 1, card.cardId);

  if (card.cardId === "SOR_168") {
    const readyUnits = getAllUnits(next.game).filter(
      (unit) => unit.controller === 1 && unit.ready,
    );
    if (readyUnits.length > 0) {
      next.prompt = {
        kind: "attack-attacker",
        title: "Precision Fire: choose a ready unit to attack with.",
        source: "precision-fire",
        powerBonus: 0,
        saboteur: true,
        defeatAfterCombatDamage: false,
      };
      return next;
    }
  }

  if (card.cardId === "SOR_103") {
    const readyRebels = getAllUnits(next.game).filter(
      (unit) =>
        unit.controller === 1 && unit.ready && hasTrait(unit.cardId, "Rebel"),
    );
    if (readyRebels.length > 0) {
      next.prompt = {
        kind: "attack-attacker",
        title: "Rebel Assault: choose a Rebel unit for the first attack.",
        source: "rebel-assault-1",
        powerBonus: 1,
        saboteur: false,
        defeatAfterCombatDamage: false,
        attackerTrait: "Rebel",
      };
      return next;
    }
  }

  if (card.cardId === "SOR_150") {
    drawCards(next.game, 1, 1, next);
    checkGameEnd(next);
    if (next.status !== "playing") {
      next.prompt = null;
      return next;
    }

    const readyUnits = getAllUnits(next.game).filter(
      (unit) => unit.controller === 1 && unit.ready,
    );
    if (readyUnits.length > 0) {
      next.prompt = {
        kind: "attack-attacker",
        title: "Heroic Sacrifice: choose a ready unit to attack with.",
        source: "heroic-sacrifice",
        powerBonus: 2,
        saboteur: false,
        defeatAfterCombatDamage: true,
      };
      return next;
    }
  }

  next.prompt = null;
  checkGameEnd(next);
  return next;
}

// ---------------------------------------------------------------------------
// handleLeaderClick
// ---------------------------------------------------------------------------

export function handleLeaderClick(runtime: PuzzleRuntime): PuzzleRuntime {
  if (
    runtime.status !== "playing" ||
    runtime.prompt ||
    runtime.game.player1.leader.deployed
  ) {
    return runtime;
  }

  const canUseAbility = canLeaderUseAbility(runtime.game, 1);
  const canDeploy = canLeaderDeploy(runtime.game, 1);

  if (canUseAbility && canDeploy) {
    const next = withSnapshot(runtime);
    next.prompt = {
      kind: "leader-choice",
      title: "Choose whether to use Sabine's action ability or deploy her.",
      player: 1,
      options: ["ability", "deploy"],
    };
    return next;
  }

  if (canUseAbility) {
    return performLeaderAbility(runtime);
  }

  if (canDeploy) {
    return performLeaderDeploy(runtime);
  }

  return runtime;
}

// ---------------------------------------------------------------------------
// handleUnitClick
// ---------------------------------------------------------------------------

export function handleUnitClick(runtime: PuzzleRuntime, playId: string): PuzzleRuntime {
  if (runtime.status !== "playing") {
    return runtime;
  }

  const clickedUnit = getUnitByPlayId(runtime.game, playId);
  if (!clickedUnit) {
    return runtime;
  }

  const prompt = runtime.prompt;

  if (prompt?.kind === "hammerhead-target") {
    const next = runtime;
    clickedUnit.damage += prompt.damage;
    logMessage(
      next,
      `Rebellious Hammerhead dealt ${prompt.damage} damage to ${CardTitle(clickedUnit.cardId) ?? clickedUnit.cardId}.`,
    );
    if (getUnitCurrentHp(clickedUnit) <= 0) {
      const defeatPrompt = defeatUnit(next.game, clickedUnit.playId);
      next.prompt = defeatPrompt;
      checkGameEnd(next);
      return next;
    }
    next.prompt = null;
    checkGameEnd(next);
    return next;
  }

  if (prompt?.kind === "attack-attacker") {
    if (clickedUnit.controller !== 1 || !clickedUnit.ready) {
      return runtime;
    }
    if (prompt.attackerTrait && !hasTrait(clickedUnit.cardId, prompt.attackerTrait)) {
      return runtime;
    }
    if (prompt.mustBeDifferentFrom && prompt.mustBeDifferentFrom === clickedUnit.playId) {
      return runtime;
    }

    let powerBonus = prompt.powerBonus;
    if (prompt.source === "precision-fire" && hasTrait(clickedUnit.cardId, "Trooper")) {
      powerBonus += 2;
    }

    return {
      ...runtime,
      prompt: {
        kind: "attack-target",
        title: `${CardTitle(clickedUnit.cardId) ?? clickedUnit.cardId}: choose what to attack.`,
        source: prompt.source,
        attackerPlayId: clickedUnit.playId,
        powerBonus,
        saboteur: prompt.saboteur,
        defeatAfterCombatDamage: prompt.defeatAfterCombatDamage,
        mustBeDifferentFrom: prompt.mustBeDifferentFrom,
      },
    };
  }

  if (prompt?.kind === "attack-target") {
    if (clickedUnit.controller !== 2) {
      return runtime;
    }

    const attacker = getUnitByPlayId(runtime.game, prompt.attackerPlayId);
    if (!attacker) {
      return runtime;
    }

    const legalTargets = getAttackTargets(runtime.game, attacker, prompt.saboteur);
    if (
      !legalTargets.some(
        (target) => target.type === "unit" && target.playId === clickedUnit.playId,
      )
    ) {
      return runtime;
    }

    return resolveAttack(
      runtime,
      attacker.playId,
      { type: "unit", playId: clickedUnit.playId },
      prompt,
    );
  }

  if (!runtime.prompt && clickedUnit.controller === 1 && clickedUnit.ready) {
    const next = withSnapshot(runtime);
    next.prompt = {
      kind: "attack-target",
      title: `${CardTitle(clickedUnit.cardId) ?? clickedUnit.cardId}: choose what to attack.`,
      source: "normal-attack",
      attackerPlayId: clickedUnit.playId,
      powerBonus: 0,
      saboteur: false,
      defeatAfterCombatDamage: false,
    };
    return next;
  }

  return runtime;
}

// ---------------------------------------------------------------------------
// handleBaseClick
// ---------------------------------------------------------------------------

export function handleBaseClick(runtime: PuzzleRuntime, player: PlayerId): PuzzleRuntime {
  if (
    runtime.status !== "playing" ||
    !runtime.prompt ||
    runtime.prompt.kind !== "attack-target"
  ) {
    return runtime;
  }

  const attacker = getUnitByPlayId(runtime.game, runtime.prompt.attackerPlayId);
  if (!attacker) {
    return runtime;
  }

  const legalTargets = getAttackTargets(runtime.game, attacker, runtime.prompt.saboteur);
  if (
    !legalTargets.some((target) => target.type === "base" && target.player === player)
  ) {
    return runtime;
  }

  return resolveAttack(runtime, attacker.playId, { type: "base", player }, runtime.prompt);
}

// ---------------------------------------------------------------------------
// handlePromptOption
// ---------------------------------------------------------------------------

export function handlePromptOption(runtime: PuzzleRuntime, optionId: string): PuzzleRuntime {
  const prompt = runtime.prompt;
  if (!prompt) {
    return runtime;
  }

  if (prompt.kind === "leader-choice") {
    if (optionId === "ability") return performLeaderAbility(runtime);
    if (optionId === "deploy") return performLeaderDeploy(runtime);
    return runtime;
  }

  if (prompt.kind === "hammerhead-target") {
    if (optionId === "skip") {
      return { ...runtime, prompt: null };
    }
    return runtime;
  }

  if (prompt.kind === "k2so-choice") {
    const next = runtime;
    if (optionId === "base-damage") {
      dealBaseDamage(next.game, prompt.targetPlayer, 3);
      logMessage(next, "K-2SO dealt 3 damage to the enemy base when defeated.");
    } else if (optionId === "discard-card") {
      const hand = getPlayerState(next.game, prompt.targetPlayer).hand;
      if (hand.length > 0) {
        const discarded = hand.pop();
        if (discarded) {
          pushPlayedEventToDiscard(next.game, prompt.targetPlayer, discarded.cardId);
          logMessage(next, "K-2SO forced the opponent to discard a card.");
        }
      }
    }
    next.prompt = null;
    checkGameEnd(next);
    return next;
  }

  return runtime;
}

// ---------------------------------------------------------------------------
// handlePass
// ---------------------------------------------------------------------------

export function handlePass(runtime: PuzzleRuntime): PuzzleRuntime {
  if (runtime.status !== "playing" || runtime.prompt) {
    return runtime;
  }

  const next = withSnapshot(runtime);
  next.game.gamePhase = 1;
  logMessage(next, "Player 1 passed. Regroup Draw begins.");

  for (const player of [1, 2] as const) {
    drawCards(next.game, player, 2, next);
  }

  checkGameEnd(next);
  if (next.status === "playing") {
    next.status = "lost";
    logMessage(next, "Puzzle failed. You did not win before the end of the Regroup Draw step.");
  }
  next.prompt = null;
  return next;
}

// ---------------------------------------------------------------------------
// handleTakeInitiative
// ---------------------------------------------------------------------------

export function handleTakeInitiative(runtime: PuzzleRuntime): PuzzleRuntime {
  if (runtime.status !== "playing" || runtime.prompt || runtime.game.initiativeClaimed) {
    return runtime;
  }

  const next = withSnapshot(runtime);
  next.game.initiativeClaimed = true;
  next.game.initiativePlayer = 1;
  logMessage(next, "Player 1 took the initiative.");
  return next;
}

// ---------------------------------------------------------------------------
// dispatchPuzzleAction — the single entry point replacing reducePuzzle
// ---------------------------------------------------------------------------

export function dispatchPuzzleAction(
  runtime: PuzzleRuntime | undefined,
  intent: PuzzleIntent,
): PuzzleRuntime {
  if (intent.type === "reset") {
    return createPuzzleRuntime();
  }

  const rt = runtime ?? createPuzzleRuntime();

  if (intent.type === "undo") {
    const previous = rt.history[rt.history.length - 1];
    if (!previous) return rt;
    return {
      game: cloneGame(previous.game),
      history: rt.history.slice(0, -1),
      log: [...previous.log, "Player 1 requested undo."],
      status: previous.status,
      prompt: previous.prompt ? cloneGame(previous.prompt) : null,
    };
  }

  switch (intent.type) {
    case "click-hand":
      return handlePlayCard(rt, intent.handIndex);
    case "click-leader":
      return intent.player === 1 ? handleLeaderClick(rt) : rt;
    case "click-unit":
      return handleUnitClick(rt, intent.playId);
    case "click-base":
      return handleBaseClick(rt, intent.player);
    case "choose-option":
      return handlePromptOption(rt, intent.optionId);
    case "pass":
      return handlePass(rt);
    case "take-initiative":
      return handleTakeInitiative(rt);
    default:
      return rt;
  }
}
