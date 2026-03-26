/**
 * Phase 2 — shared primitives for server-side puzzle action handlers.
 *
 * This module mirrors the internal helpers that were previously bundled inside
 * src/lib/puzzles/engine.ts, but lives in the server engine so it can reach
 * the real keyword implementations (HasSentinel, etc.) via the singleton.
 *
 * IMPORTANT: `getAttackTargets` calls HasSentinel which reads from the
 * SetGame/GetGame singleton. The singleton must be active (set via
 * withPuzzleGame / the wrapper in resolve-action) before calling it.
 */

import {
  CardArena,
  CardAspects,
  CardCost,
  CardHp,
  CardPower,
  CardTitle,
  CardTraits,
  CardType,
} from "@/server/engine/card-db/generated";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { PlayerId as ServerPlayerId } from "@/server/engine/core-models";
import type {
  AttackSource,
  PlayerId,
  PuzzleBase,
  PuzzleDiscard,
  PuzzleGameState,
  PuzzleLeader,
  PuzzlePlayerState,
  PuzzlePrompt,
  PuzzleResource,
  PuzzleRuntime,
  PuzzleStatus,
  PuzzleUnit,
  RawCard,
  RuntimeSnapshot,
} from "@/lib/puzzles/types";

// Re-export all shared puzzle types so handler files only need this import.
export type {
  AttackSource,
  PlayerId,
  PuzzleBase,
  PuzzleDiscard,
  PuzzleGameState,
  PuzzleLeader,
  PuzzlePlayerState,
  PuzzlePrompt,
  PuzzleResource,
  PuzzleRuntime,
  PuzzleStatus,
  PuzzleUnit,
  RawCard,
  RuntimeSnapshot,
};

// ---------------------------------------------------------------------------
// Tiny utilities
// ---------------------------------------------------------------------------

export function cloneGame<T>(value: T): T {
  return structuredClone(value);
}

export function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 1 ? 2 : 1;
}

function toServerId(id: PlayerId): ServerPlayerId {
  return id as unknown as ServerPlayerId;
}

// ---------------------------------------------------------------------------
// State accessors
// ---------------------------------------------------------------------------

export function getPlayerState(
  game: PuzzleGameState,
  player: PlayerId,
): PuzzlePlayerState {
  return player === 1 ? game.player1 : game.player2;
}

export function getArenaUnits(
  game: PuzzleGameState,
  player: PlayerId,
  arena: "Ground" | "Space",
): PuzzleUnit[] {
  const ps = getPlayerState(game, player);
  return arena === "Ground" ? ps.groundArena : ps.spaceArena;
}

export function newPlayId(game: PuzzleGameState): string {
  const id = String(game.nextPlayId);
  game.nextPlayId += 1;
  return id;
}

export function findArenaUnit(
  game: PuzzleGameState,
  playId: string,
): {
  player: PlayerId;
  zone: "groundArena" | "spaceArena";
  unit: PuzzleUnit;
} | null {
  for (const player of [1, 2] as const) {
    const ps = getPlayerState(game, player);
    const ground = ps.groundArena.find((u) => u.playId === playId);
    if (ground) return { player, zone: "groundArena", unit: ground };
    const space = ps.spaceArena.find((u) => u.playId === playId);
    if (space) return { player, zone: "spaceArena", unit: space };
  }
  return null;
}

export function getUnitByPlayId(
  game: PuzzleGameState,
  playId: string,
): PuzzleUnit | null {
  return findArenaUnit(game, playId)?.unit ?? null;
}

export function getAllUnits(
  game: PuzzleGameState,
): PuzzleUnit[] {
  return [
    ...game.player1.groundArena,
    ...game.player1.spaceArena,
    ...game.player2.groundArena,
    ...game.player2.spaceArena,
  ];
}

export function getHandCard(
  game: PuzzleGameState,
  handIndex: number,
): RawCard | null {
  return getPlayerState(game, 1).hand[handIndex] ?? null;
}

export function removeHandCard(
  game: PuzzleGameState,
  handIndex: number,
): RawCard | null {
  const hand = getPlayerState(game, 1).hand;
  const [removed] = hand.splice(handIndex, 1);
  return removed ?? null;
}

// ---------------------------------------------------------------------------
// Log helper
// ---------------------------------------------------------------------------

export function logMessage(
  runtime: PuzzleRuntime,
  message: string,
): void {
  runtime.log.push(message);
}

// ---------------------------------------------------------------------------
// Snapshot / undo
// ---------------------------------------------------------------------------

function createSnapshot(
  runtime: PuzzleRuntime,
): RuntimeSnapshot {
  return {
    game: cloneGame(runtime.game),
    log: [...runtime.log],
    status: runtime.status,
    prompt: runtime.prompt ? cloneGame(runtime.prompt) : null,
  };
}

export function withSnapshot(
  runtime: PuzzleRuntime,
): PuzzleRuntime {
  return {
    game: cloneGame(runtime.game),
    history: [...runtime.history, createSnapshot(runtime)],
    log: [...runtime.log],
    status: runtime.status,
    prompt: runtime.prompt ? cloneGame(runtime.prompt) : null,
  };
}

// ---------------------------------------------------------------------------
// Card stat helpers
// ---------------------------------------------------------------------------

function getRaidValue(cardId: string): number {
  return cardId === "SOR_141" ? 2 : 0;
}

export function hasOverwhelm(cardId: string): boolean {
  return cardId === "SOR_145";
}

export function hasTrait(cardId: string, trait: string): boolean {
  return splitCsv(CardTraits(cardId)).includes(trait);
}

export function getUnitCurrentHp(
  unit: PuzzleUnit,
): number {
  return (CardHp(unit.cardId) ?? 0) - unit.damage;
}

export function getUnitCurrentPower(
  unit: PuzzleUnit,
  opts?: { attacking?: boolean; powerBonus?: number },
): number {
  let power = CardPower(unit.cardId) ?? 0;
  if (opts?.attacking) power += getRaidValue(unit.cardId);
  power += opts?.powerBonus ?? 0;
  return power;
}

// ---------------------------------------------------------------------------
// Affordability
// ---------------------------------------------------------------------------

export function getReadyResources(
  game: PuzzleGameState,
  player: PlayerId,
): PuzzleResource[] {
  return getPlayerState(game, player).resources.filter((r) => r.ready);
}

export function getCardAspectPenalty(
  game: PuzzleGameState,
  player: PlayerId,
  cardId: string,
): number {
  const ps = getPlayerState(game, player);
  const provided = [
    ...splitCsv(CardAspects(ps.base.cardId)),
    ...splitCsv(CardAspects(ps.leader.cardId)),
  ];
  const counts = new Map<string, number>();
  for (const aspect of provided) {
    counts.set(aspect, (counts.get(aspect) ?? 0) + 1);
  }
  let missing = 0;
  for (const aspect of splitCsv(CardAspects(cardId))) {
    const remaining = counts.get(aspect) ?? 0;
    if (remaining > 0) {
      counts.set(aspect, remaining - 1);
    } else {
      missing += 1;
    }
  }
  return missing * 2;
}

export function getCardPlayCost(
  game: PuzzleGameState,
  player: PlayerId,
  cardId: string,
): number {
  return (CardCost(cardId) ?? 0) + getCardAspectPenalty(game, player, cardId);
}

export function canAffordCard(
  game: PuzzleGameState,
  player: PlayerId,
  cardId: string,
): boolean {
  return getReadyResources(game, player).length >= getCardPlayCost(game, player, cardId);
}

export function exhaustResources(
  game: PuzzleGameState,
  player: PlayerId,
  amount: number,
): void {
  const ready = getReadyResources(game, player);
  for (const resource of ready.slice(0, amount)) {
    resource.ready = false;
  }
}

// ---------------------------------------------------------------------------
// Leader helpers
// ---------------------------------------------------------------------------

export function canLeaderUseAbility(
  game: PuzzleGameState,
  player: PlayerId,
): boolean {
  const leader = getPlayerState(game, player).leader;
  return !leader.deployed && leader.ready;
}

/**
 * Phase 2 fix: uses actual card cost + ready resources rather than the
 * stub `resources.length >= 4` from engine.ts.
 */
export function canLeaderDeploy(
  game: PuzzleGameState,
  player: PlayerId,
): boolean {
  const leader = getPlayerState(game, player).leader;
  return (
    !leader.deployed &&
    !leader.epicActionUsed &&
    getReadyResources(game, player).length >= getCardPlayCost(game, player, leader.cardId)
  );
}

// ---------------------------------------------------------------------------
// Arena mutations
// ---------------------------------------------------------------------------

export function addUnitToArena(
  game: PuzzleGameState,
  player: PlayerId,
  cardId: string,
  ready: boolean,
  linkedLeader = false,
): PuzzleUnit {
  const unit: PuzzleUnit = {
    cardId,
    playId: newPlayId(game),
    owner: player,
    controller: player,
    ready,
    damage: 0,
    upgrades: [],
    captives: [],
    linkedLeader,
  };
  const arena = (CardArena(cardId) ?? "Ground") as "Ground" | "Space";
  getArenaUnits(game, player, arena).push(unit);
  return unit;
}

export function removeArenaUnit(
  game: PuzzleGameState,
  playId: string,
): { player: PlayerId; unit: PuzzleUnit } | null {
  const location = findArenaUnit(game, playId);
  if (!location) return null;
  const ps = getPlayerState(game, location.player);
  const zone = ps[location.zone];
  const index = zone.findIndex((u) => u.playId === playId);
  if (index === -1) return null;
  const [removed] = zone.splice(index, 1);
  return { player: location.player, unit: removed };
}

export function moveToDiscard(
  game: PuzzleGameState,
  player: PlayerId,
  card: PuzzleUnit | PuzzleDiscard,
): void {
  getPlayerState(game, player).discard.unshift({
    cardId: card.cardId,
    playId: card.playId,
    owner: card.owner,
    controller: card.owner,
    turnDiscarded: game.currentRound,
    discardEffect: "TTFREE",
  });
}

export function pushPlayedEventToDiscard(
  game: PuzzleGameState,
  player: PlayerId,
  cardId: string,
): void {
  getPlayerState(game, player).discard.unshift({
    cardId,
    playId: newPlayId(game),
    owner: player,
    controller: player,
    turnDiscarded: game.currentRound,
    discardEffect: "TTFREE",
  });
}

export function dealBaseDamage(
  game: PuzzleGameState,
  player: PlayerId,
  amount: number,
): void {
  getPlayerState(game, player).base.damage += amount;
}

export function drawCards(
  game: PuzzleGameState,
  player: PlayerId,
  count: number,
  runtime: PuzzleRuntime,
): void {
  const ps = getPlayerState(game, player);
  for (let i = 0; i < count; i++) {
    const card = ps.deck.shift();
    if (!card) {
      logMessage(runtime, `${player === 1 ? "Player 1" : "Player 2"} could not draw a card.`);
      dealBaseDamage(game, player, 3);
      logMessage(runtime, `${player === 1 ? "Player 1" : "Player 2"} took 3 damage from drawing with no deck.`);
      continue;
    }
    ps.hand.push(card);
    logMessage(runtime, `${player === 1 ? "Player 1" : "Player 2"} drew ${CardTitle(card.cardId) ?? card.cardId}.`);
  }
}

// ---------------------------------------------------------------------------
// Defeat / game-end
// ---------------------------------------------------------------------------

export function defeatUnit(
  game: PuzzleGameState,
  playId: string,
): PuzzlePrompt | null {
  const removed = removeArenaUnit(game, playId);
  if (!removed) return null;
  const { player, unit } = removed;

  if (unit.linkedLeader) {
    const leader = getPlayerState(game, player).leader;
    leader.deployed = false;
    leader.ready = false;
    leader.deployedPlayId = undefined;
    return null;
  }

  moveToDiscard(game, player, unit);

  if (unit.cardId === "SOR_145") {
    const targetPlayer = otherPlayer(player);
    if (getPlayerState(game, targetPlayer).hand.length === 0) {
      getPlayerState(game, targetPlayer).base.damage += 3;
      return null;
    }
    return {
      kind: "k2so-choice" as const,
      title: "K-2SO was defeated. Choose its When Defeated effect.",
      targetPlayer,
    };
  }

  return null;
}

export function checkGameEnd(
  runtime: PuzzleRuntime,
): void {
  if (runtime.status !== "playing") return;

  const p1Hp = CardHp(runtime.game.player1.base.cardId) ?? 30;
  const p2Hp = CardHp(runtime.game.player2.base.cardId) ?? 30;
  const defeated: PlayerId[] = [];
  if (runtime.game.player1.base.damage >= p1Hp) defeated.push(1);
  if (runtime.game.player2.base.damage >= p2Hp) defeated.push(2);
  runtime.game.defeatedPlayers = defeated;

  if (defeated.length === 0) return;

  if (defeated.length === 2) {
    runtime.status = "draw";
    runtime.prompt = null;
    logMessage(runtime, "Puzzle ended in a draw. Both bases were defeated.");
    return;
  }

  if (defeated[0] === 2) {
    runtime.status = "won";
    runtime.prompt = null;
    logMessage(runtime, "Puzzle complete. You destroyed the opponent base.");
    return;
  }

  runtime.status = "lost";
  runtime.prompt = null;
  logMessage(runtime, "Puzzle failed. Your base was defeated.");
}

// ---------------------------------------------------------------------------
// Attack targets — uses real HasSentinel via singleton (singleton must be
// active when this is called; see resolve-action.ts wrapper)
// ---------------------------------------------------------------------------

function hasSentinelReal(
  cardId: string,
  playId: string,
  controller: PlayerId,
): boolean {
  try {
    return HasSentinel(cardId, playId, toServerId(controller));
  } catch {
    return false;
  }
}

type AttackTarget =
  | { type: "unit"; playId: string }
  | { type: "base"; player: PlayerId };

export function getAttackTargets(
  game: PuzzleGameState,
  attacker: PuzzleUnit,
  saboteur: boolean,
): AttackTarget[] {
  const arena = (CardArena(attacker.cardId) ?? "Ground") as "Ground" | "Space";
  const defenderPlayer = otherPlayer(attacker.controller);
  const opposingUnits = getArenaUnits(game, defenderPlayer, arena);
  const sentinels = opposingUnits.filter((u) =>
    hasSentinelReal(u.cardId, u.playId, u.controller),
  );

  if (sentinels.length > 0 && !saboteur) {
    return sentinels.map((u) => ({ type: "unit" as const, playId: u.playId }));
  }

  return [
    ...opposingUnits.map((u) => ({ type: "unit" as const, playId: u.playId })),
    { type: "base" as const, player: defenderPlayer },
  ];
}

// ---------------------------------------------------------------------------
// resolveAttack
// ---------------------------------------------------------------------------

export function resolveAttack(
  runtime: PuzzleRuntime,
  attackerPlayId: string,
  target: { type: "base"; player: PlayerId } | { type: "unit"; playId: string },
  options: {
    powerBonus: number;
    saboteur: boolean;
    defeatAfterCombatDamage: boolean;
    source: AttackSource;
  },
): PuzzleRuntime {
  const attacker = getUnitByPlayId(runtime.game, attackerPlayId);
  if (!attacker) return runtime;

  attacker.ready = false;
  const attackerPower = getUnitCurrentPower(attacker, {
    attacking: true,
    powerBonus: options.powerBonus,
  });

  // Sabine Wren on-attack ability
  if (attacker.cardId === "SOR_014" && attacker.linkedLeader) {
    dealBaseDamage(runtime.game, 2, 1);
    logMessage(runtime, "Sabine Wren dealt 1 damage to the enemy base with her On Attack ability.");
  }

  if (target.type === "base") {
    dealBaseDamage(runtime.game, target.player, attackerPower);
    logMessage(
      runtime,
      `${CardTitle(attacker.cardId) ?? attacker.cardId} attacked the enemy base for ${attackerPower} damage.`,
    );
  } else {
    const defender = getUnitByPlayId(runtime.game, target.playId);
    if (!defender) return runtime;

    const defenderHpBefore = getUnitCurrentHp(defender);
    const defenderPower = getUnitCurrentPower(defender);
    defender.damage += attackerPower;
    attacker.damage += defenderPower;
    logMessage(
      runtime,
      `${CardTitle(attacker.cardId) ?? attacker.cardId} attacked ${CardTitle(defender.cardId) ?? defender.cardId}.`,
    );

    if (hasOverwhelm(attacker.cardId)) {
      const excess = Math.max(attackerPower - defenderHpBefore, 0);
      if (excess > 0) {
        dealBaseDamage(runtime.game, otherPlayer(attacker.controller), excess);
        logMessage(
          runtime,
          `${CardTitle(attacker.cardId) ?? attacker.cardId} dealt ${excess} Overwhelm damage to the enemy base.`,
        );
      }
    }

    const prompts: PuzzlePrompt[] = [];
    if (getUnitCurrentHp(defender) <= 0) {
      const p = defeatUnit(runtime.game, defender.playId);
      if (p) prompts.push(p);
    }
    if (getUnitCurrentHp(attacker) <= 0) {
      const p = defeatUnit(runtime.game, attacker.playId);
      if (p) prompts.push(p);
    }
    if (prompts.length > 0) {
      runtime.prompt = prompts[0];
      checkGameEnd(runtime);
      return runtime;
    }
  }

  if (options.defeatAfterCombatDamage) {
    const stillInPlay = getUnitByPlayId(runtime.game, attackerPlayId);
    if (stillInPlay) {
      const p = defeatUnit(runtime.game, attackerPlayId);
      if (p) {
        runtime.prompt = p;
        checkGameEnd(runtime);
        return runtime;
      }
      logMessage(
        runtime,
        `${CardTitle(attacker.cardId) ?? attacker.cardId} was defeated by Heroic Sacrifice.`,
      );
    }
  }

  if (options.source === "rebel-assault-1") {
    const readyRebels = getAllUnits(runtime.game).filter(
      (u) => u.controller === 1 && u.ready && hasTrait(u.cardId, "Rebel") && u.playId !== attackerPlayId,
    );
    if (readyRebels.length > 0) {
      runtime.prompt = {
        kind: "attack-attacker",
        title: "Rebel Assault: choose another Rebel unit to make the second attack.",
        source: "rebel-assault-2",
        powerBonus: 1,
        saboteur: false,
        defeatAfterCombatDamage: false,
        attackerTrait: "Rebel",
        mustBeDifferentFrom: attackerPlayId,
      };
      checkGameEnd(runtime);
      return runtime;
    }
  }

  runtime.prompt = null;
  checkGameEnd(runtime);
  return runtime;
}

// ---------------------------------------------------------------------------
// Card-type helper (re-export for handler use)
// ---------------------------------------------------------------------------

export { CardType };
