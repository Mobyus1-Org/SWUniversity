import rawTestPuzzle from "../../test-puzzle.json";

import {
  CardArena,
  CardAspects,
  CardCost,
  CardHp,
  CardPower,
  CardSubtitle,
  CardTitle,
  CardTraits,
  CardType,
} from "@/server/engine/card-db/generated";

export type PlayerId = 1 | 2;
export type PuzzleStatus = "playing" | "won" | "lost";

type RawCard = {
  cardId: string;
};

type RawBase = {
  cardId: string;
  epicActionUsed: boolean;
  damage: number;
};

type RawLeader = {
  cardId: string;
  epicActionUsed: boolean;
  ready: boolean;
  deployed: boolean;
};

type RawCardInPlay = {
  cardId: string;
  playId: string;
  owner: PlayerId;
  controller: PlayerId;
};

type RawUnit = RawCardInPlay & {
  ready: boolean;
  damage: number;
  upgrades: RawCardInPlay[];
  captives: RawUnit[];
};

type RawResource = RawCardInPlay & {
  ready: boolean;
};

type RawDiscard = RawCardInPlay & {
  turnDiscarded?: number;
  discardEffect?: "TTFREE" | "OTTFREE";
};

type RawGameState = {
  activePlayer: PlayerId;
  gamePhase: number;
  nextPlayId: number;
  player1: RawPlayerState;
  player2: RawPlayerState;
  currentEffects: Array<{ cardId: string; duration?: number; affectedPlayer?: PlayerId; targetPlayId?: string }>;
  currentRound: number;
  initiativePlayer: PlayerId;
  initiativeClaimed: boolean;
  triggerBag: unknown[];
};

type RawPlayerState = {
  base: RawBase;
  leader: RawLeader;
  spaceArena: RawUnit[];
  groundArena: RawUnit[];
  resources: RawResource[];
  discard: RawDiscard[];
  deck: RawCard[];
  hand: RawCard[];
  supplemental: {
    forceToken?: boolean;
    creditTokens?: number;
  };
};

export type PuzzleBase = RawBase;

export type PuzzleLeader = RawLeader & {
  deployedPlayId?: string;
};

export type PuzzleAttachment = RawCardInPlay;

export type PuzzleUnit = RawCardInPlay & {
  ready: boolean;
  damage: number;
  upgrades: PuzzleAttachment[];
  captives: PuzzleUnit[];
  linkedLeader?: boolean;
};

export type PuzzleResource = RawResource;

export type PuzzleDiscard = RawDiscard & {
  turnDiscarded: number;
  discardEffect: "TTFREE" | "OTTFREE";
};

export type PuzzlePlayerState = {
  base: PuzzleBase;
  leader: PuzzleLeader;
  spaceArena: PuzzleUnit[];
  groundArena: PuzzleUnit[];
  resources: PuzzleResource[];
  discard: PuzzleDiscard[];
  deck: RawCard[];
  hand: RawCard[];
  supplemental: {
    forceToken?: boolean;
    creditTokens?: number;
  };
  lastActionWasPass?: boolean;
};

export type PuzzleGameState = {
  activePlayer: PlayerId;
  gamePhase: number;
  nextPlayId: number;
  player1: PuzzlePlayerState;
  player2: PuzzlePlayerState;
  currentEffects: Array<{ cardId: string; duration?: number; affectedPlayer?: PlayerId; targetPlayId?: string }>;
  currentRound: number;
  initiativePlayer: PlayerId;
  initiativeClaimed: boolean;
  triggerBag: unknown[];
};

type AttackSource = "normal-attack" | "precision-fire" | "rebel-assault-1" | "rebel-assault-2" | "heroic-sacrifice";

export type PuzzlePrompt =
  | {
      kind: "leader-choice";
      title: string;
      player: PlayerId;
      options: Array<"ability" | "deploy">;
    }
  | {
      kind: "hammerhead-target";
      title: string;
      unitPlayId: string;
      damage: number;
    }
  | {
      kind: "attack-attacker";
      title: string;
      source: AttackSource;
      powerBonus: number;
      saboteur: boolean;
      defeatAfterCombatDamage: boolean;
      attackerTrait?: string;
      mustBeDifferentFrom?: string;
    }
  | {
      kind: "attack-target";
      title: string;
      source: AttackSource;
      attackerPlayId: string;
      powerBonus: number;
      saboteur: boolean;
      defeatAfterCombatDamage: boolean;
      mustBeDifferentFrom?: string;
    }
  | {
      kind: "k2so-choice";
      title: string;
      targetPlayer: PlayerId;
    };

type RuntimeSnapshot = {
  game: PuzzleGameState;
  log: string[];
  status: PuzzleStatus;
  prompt: PuzzlePrompt | null;
};

export type PuzzleRuntime = {
  game: PuzzleGameState;
  history: RuntimeSnapshot[];
  log: string[];
  status: PuzzleStatus;
  prompt: PuzzlePrompt | null;
};

export type PuzzleIntent =
  | { type: "click-hand"; handIndex: number }
  | { type: "click-unit"; playId: string }
  | { type: "click-base"; player: PlayerId }
  | { type: "click-leader"; player: PlayerId }
  | { type: "choose-option"; optionId: string }
  | { type: "pass" }
  | { type: "take-initiative" }
  | { type: "undo" }
  | { type: "reset" };

const testPuzzle = rawTestPuzzle as RawGameState;

function cloneGame<T>(value: T): T {
  return structuredClone(value);
}

function splitCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 1 ? 2 : 1;
}

function createSnapshot(runtime: PuzzleRuntime): RuntimeSnapshot {
  return {
    game: cloneGame(runtime.game),
    log: [...runtime.log],
    status: runtime.status,
    prompt: runtime.prompt ? cloneGame(runtime.prompt) : null,
  };
}

function withSnapshot(runtime: PuzzleRuntime): PuzzleRuntime {
  return {
    game: cloneGame(runtime.game),
    history: [...runtime.history, createSnapshot(runtime)],
    log: [...runtime.log],
    status: runtime.status,
    prompt: runtime.prompt ? cloneGame(runtime.prompt) : null,
  };
}

function logMessage(runtime: PuzzleRuntime, message: string): void {
  runtime.log.push(message);
}

function hydrateUnit(unit: RawUnit, nextPlayIdRef: { value: number }): PuzzleUnit {
  const playId = unit.playId === "@" ? String(nextPlayIdRef.value++) : unit.playId;

  return {
    cardId: unit.cardId,
    playId,
    owner: unit.owner,
    controller: unit.controller,
    ready: unit.ready,
    damage: unit.damage,
    upgrades: unit.upgrades.map((upgrade) => ({
      ...upgrade,
      playId: upgrade.playId === "@" ? String(nextPlayIdRef.value++) : upgrade.playId,
    })),
    captives: unit.captives.map((captive) => hydrateUnit(captive, nextPlayIdRef)),
  };
}

function hydrateResource(resource: RawResource, nextPlayIdRef: { value: number }): PuzzleResource {
  return {
    ...resource,
    playId: resource.playId === "@" ? String(nextPlayIdRef.value++) : resource.playId,
  };
}

function hydrateDiscard(card: RawDiscard, nextPlayIdRef: { value: number }): PuzzleDiscard {
  return {
    ...card,
    playId: card.playId === "@" ? String(nextPlayIdRef.value++) : card.playId,
    controller: card.controller,
    turnDiscarded: card.turnDiscarded ?? 0,
    discardEffect: card.discardEffect ?? "TTFREE",
  };
}

function hydratePlayer(player: RawPlayerState, nextPlayIdRef: { value: number }): PuzzlePlayerState {
  return {
    base: cloneGame(player.base),
    leader: cloneGame(player.leader),
    spaceArena: player.spaceArena.map((unit) => hydrateUnit(unit, nextPlayIdRef)),
    groundArena: player.groundArena.map((unit) => hydrateUnit(unit, nextPlayIdRef)),
    resources: player.resources.map((resource) => hydrateResource(resource, nextPlayIdRef)),
    discard: player.discard.map((card) => hydrateDiscard(card, nextPlayIdRef)),
    deck: cloneGame(player.deck),
    hand: cloneGame(player.hand),
    supplemental: cloneGame(player.supplemental),
  };
}

function hydrateGame(rawGame: RawGameState): PuzzleGameState {
  const nextPlayIdRef = { value: rawGame.nextPlayId };

  const player1 = hydratePlayer(rawGame.player1, nextPlayIdRef);
  const player2 = hydratePlayer(rawGame.player2, nextPlayIdRef);

  return {
    activePlayer: rawGame.activePlayer,
    gamePhase: rawGame.gamePhase,
    nextPlayId: nextPlayIdRef.value,
    player1,
    player2,
    currentEffects: cloneGame(rawGame.currentEffects),
    currentRound: rawGame.currentRound,
    initiativePlayer: rawGame.initiativePlayer,
    initiativeClaimed: rawGame.initiativeClaimed,
    triggerBag: cloneGame(rawGame.triggerBag),
  };
}

export function createPuzzleRuntime(): PuzzleRuntime {
  const game = hydrateGame(testPuzzle);

  return {
    game,
    history: [],
    log: [
      "Puzzle loaded.",
      "Opponent has already claimed the initiative.",
      "Click a hand card to play it, click your leader for ability/deploy, or click a ready friendly unit to attack.",
    ],
    status: "playing",
    prompt: null,
  };
}

function getPlayerState(game: PuzzleGameState, player: PlayerId): PuzzlePlayerState {
  return player === 1 ? game.player1 : game.player2;
}

function getArenaUnits(game: PuzzleGameState, player: PlayerId, arena: "Ground" | "Space"): PuzzleUnit[] {
  const playerState = getPlayerState(game, player);
  return arena === "Ground" ? playerState.groundArena : playerState.spaceArena;
}

function newPlayId(game: PuzzleGameState): string {
  const playId = String(game.nextPlayId);
  game.nextPlayId += 1;
  return playId;
}

function getReadyResources(game: PuzzleGameState, player: PlayerId): PuzzleResource[] {
  return getPlayerState(game, player).resources.filter((resource) => resource.ready);
}

function getCardAspectPenalty(game: PuzzleGameState, player: PlayerId, cardId: string): number {
  const playerState = getPlayerState(game, player);
  const provided = [...splitCsv(CardAspects(playerState.base.cardId)), ...splitCsv(CardAspects(playerState.leader.cardId))];
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

function getCardPlayCost(game: PuzzleGameState, player: PlayerId, cardId: string): number {
  return (CardCost(cardId) ?? 0) + getCardAspectPenalty(game, player, cardId);
}

function canAffordCard(game: PuzzleGameState, player: PlayerId, cardId: string): boolean {
  return getReadyResources(game, player).length >= getCardPlayCost(game, player, cardId);
}

function canLeaderUseAbility(game: PuzzleGameState, player: PlayerId): boolean {
  const leader = getPlayerState(game, player).leader;
  return !leader.deployed && leader.ready;
}

function canLeaderDeploy(game: PuzzleGameState, player: PlayerId): boolean {
  const leader = getPlayerState(game, player).leader;
  return !leader.deployed && !leader.epicActionUsed && getPlayerState(game, player).resources.length >= 4;
}

function exhaustResources(game: PuzzleGameState, player: PlayerId, amount: number): void {
  const readyResources = getReadyResources(game, player);
  for (const resource of readyResources.slice(0, amount)) {
    resource.ready = false;
  }
}

function getAllUnits(game: PuzzleGameState): PuzzleUnit[] {
  return [
    ...game.player1.groundArena,
    ...game.player1.spaceArena,
    ...game.player2.groundArena,
    ...game.player2.spaceArena,
  ];
}

function hasTrait(cardId: string, trait: string): boolean {
  return splitCsv(CardTraits(cardId)).includes(trait);
}

export function hasSentinel(game: PuzzleGameState, unit: PuzzleUnit): boolean {
  if (unit.cardId === "SOR_211") {
    return true;
  }

  return false;
}

function getRaidValue(cardId: string): number {
  return cardId === "SOR_141" ? 2 : 0;
}

function hasOverwhelm(cardId: string): boolean {
  return cardId === "SOR_145";
}

function findArenaUnit(game: PuzzleGameState, playId: string): { player: PlayerId; zone: "groundArena" | "spaceArena"; unit: PuzzleUnit } | null {
  for (const player of [1, 2] as const) {
    const playerState = getPlayerState(game, player);
    const ground = playerState.groundArena.find((unit) => unit.playId === playId);
    if (ground) {
      return { player, zone: "groundArena", unit: ground };
    }

    const space = playerState.spaceArena.find((unit) => unit.playId === playId);
    if (space) {
      return { player, zone: "spaceArena", unit: space };
    }
  }

  return null;
}

function getUnitByPlayId(game: PuzzleGameState, playId: string): PuzzleUnit | null {
  return findArenaUnit(game, playId)?.unit ?? null;
}

function removeArenaUnit(game: PuzzleGameState, playId: string): { player: PlayerId; unit: PuzzleUnit } | null {
  const location = findArenaUnit(game, playId);
  if (!location) {
    return null;
  }

  const playerState = getPlayerState(game, location.player);
  const zone = playerState[location.zone];
  const index = zone.findIndex((unit) => unit.playId === playId);
  if (index === -1) {
    return null;
  }

  const [removed] = zone.splice(index, 1);
  return { player: location.player, unit: removed };
}

function moveToDiscard(game: PuzzleGameState, player: PlayerId, card: PuzzleUnit | PuzzleDiscard): void {
  getPlayerState(game, player).discard.unshift({
    cardId: card.cardId,
    playId: card.playId,
    owner: card.owner,
    controller: card.owner,
    turnDiscarded: game.currentRound,
    discardEffect: "TTFREE",
  });
}

function defeatUnit(game: PuzzleGameState, playId: string): PuzzlePrompt | null {
  const removed = removeArenaUnit(game, playId);
  if (!removed) {
    return null;
  }

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
      kind: "k2so-choice",
      title: "K-2SO was defeated. Choose its When Defeated effect.",
      targetPlayer,
    };
  }

  return null;
}

function getUnitCurrentHp(unit: PuzzleUnit): number {
  return (CardHp(unit.cardId) ?? 0) - unit.damage;
}

function getUnitCurrentPower(unit: PuzzleUnit, opts?: { attacking?: boolean; powerBonus?: number }): number {
  let power = CardPower(unit.cardId) ?? 0;
  if (opts?.attacking) {
    power += getRaidValue(unit.cardId);
  }
  power += opts?.powerBonus ?? 0;
  return power;
}

function getAttackTargets(game: PuzzleGameState, attacker: PuzzleUnit, saboteur: boolean): Array<{ type: "unit"; playId: string } | { type: "base"; player: PlayerId }> {
  const arena = (CardArena(attacker.cardId) ?? "Ground") as "Ground" | "Space";
  const defenderPlayer = otherPlayer(attacker.controller);
  const opposingUnits = getArenaUnits(game, defenderPlayer, arena);
  const sentinels = opposingUnits.filter((unit) => hasSentinel(game, unit));

  if (sentinels.length > 0 && !saboteur) {
    return sentinels.map((unit) => ({ type: "unit", playId: unit.playId }));
  }

  return [
    ...opposingUnits.map((unit) => ({ type: "unit" as const, playId: unit.playId })),
    { type: "base" as const, player: defenderPlayer },
  ];
}

function dealBaseDamage(game: PuzzleGameState, player: PlayerId, amount: number): void {
  getPlayerState(game, player).base.damage += amount;
}

function drawCards(game: PuzzleGameState, player: PlayerId, count: number, log: PuzzleRuntime): void {
  const playerState = getPlayerState(game, player);
  for (let index = 0; index < count; index += 1) {
    const card = playerState.deck.shift();
    if (!card) {
      logMessage(log, `${player === 1 ? "Player 1" : "Player 2"} could not draw a card.`);
      dealBaseDamage(game, player, 3);
      logMessage(log, `${player === 1 ? "Player 1" : "Player 2"} took 3 damage from drawing with no deck.`);
      continue;
    }
    playerState.hand.push(card);
    logMessage(log, `${player === 1 ? "Player 1" : "Player 2"} drew ${CardTitle(card.cardId) ?? card.cardId}.`);
  }
}

function resolveAttack(
  runtime: PuzzleRuntime,
  attackerPlayId: string,
  target: { type: "base"; player: PlayerId } | { type: "unit"; playId: string },
  options: { powerBonus: number; saboteur: boolean; defeatAfterCombatDamage: boolean; source: AttackSource },
): PuzzleRuntime {
  const attacker = getUnitByPlayId(runtime.game, attackerPlayId);
  if (!attacker) {
    return runtime;
  }

  attacker.ready = false;
  const attackerPower = getUnitCurrentPower(attacker, { attacking: true, powerBonus: options.powerBonus });

  if (attacker.cardId === "SOR_014" && attacker.linkedLeader) {
    dealBaseDamage(runtime.game, 2, 1);
    logMessage(runtime, "Sabine Wren dealt 1 damage to the enemy base with her On Attack ability.");
  }

  if (target.type === "base") {
    dealBaseDamage(runtime.game, target.player, attackerPower);
    logMessage(runtime, `${CardTitle(attacker.cardId) ?? attacker.cardId} attacked the enemy base for ${attackerPower} damage.`);
  } else {
    const defender = getUnitByPlayId(runtime.game, target.playId);
    if (!defender) {
      return runtime;
    }

    const defenderHpBeforeDamage = getUnitCurrentHp(defender);
    const defenderPower = getUnitCurrentPower(defender);
    defender.damage += attackerPower;
    attacker.damage += defenderPower;
    logMessage(runtime, `${CardTitle(attacker.cardId) ?? attacker.cardId} attacked ${CardTitle(defender.cardId) ?? defender.cardId}.`);

    if (hasOverwhelm(attacker.cardId)) {
      const excess = Math.max(attackerPower - defenderHpBeforeDamage, 0);
      if (excess > 0) {
        dealBaseDamage(runtime.game, otherPlayer(attacker.controller), excess);
        logMessage(runtime, `${CardTitle(attacker.cardId) ?? attacker.cardId} dealt ${excess} Overwhelm damage to the enemy base.`);
      }
    }

    const prompts: PuzzlePrompt[] = [];
    if (getUnitCurrentHp(defender) <= 0) {
      const prompt = defeatUnit(runtime.game, defender.playId);
      if (prompt) {
        prompts.push(prompt);
      }
    }

    if (getUnitCurrentHp(attacker) <= 0) {
      const prompt = defeatUnit(runtime.game, attacker.playId);
      if (prompt) {
        prompts.push(prompt);
      }
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
      const prompt = defeatUnit(runtime.game, attackerPlayId);
      if (prompt) {
        runtime.prompt = prompt;
        checkGameEnd(runtime);
        return runtime;
      }
      logMessage(runtime, `${CardTitle(attacker.cardId) ?? attacker.cardId} was defeated by Heroic Sacrifice.`);
    }
  }

  if (options.source === "rebel-assault-1") {
    const readyRebels = getAllUnits(runtime.game).filter((unit) => unit.controller === 1 && unit.ready && hasTrait(unit.cardId, "Rebel") && unit.playId !== attackerPlayId);
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

function checkGameEnd(runtime: PuzzleRuntime): void {
  const player1BaseHp = CardHp(runtime.game.player1.base.cardId) ?? 30;
  const player2BaseHp = CardHp(runtime.game.player2.base.cardId) ?? 30;

  if (runtime.game.player2.base.damage >= player2BaseHp) {
    runtime.status = "won";
    runtime.prompt = null;
    logMessage(runtime, "Puzzle complete. You destroyed the opponent base.");
    return;
  }

  if (runtime.game.player1.base.damage >= player1BaseHp) {
    runtime.status = "lost";
    runtime.prompt = null;
    logMessage(runtime, "Puzzle failed. Your base was defeated.");
  }
}

function getHandCard(game: PuzzleGameState, handIndex: number): RawCard | null {
  return getPlayerState(game, 1).hand[handIndex] ?? null;
}

function removeHandCard(game: PuzzleGameState, handIndex: number): RawCard | null {
  const hand = getPlayerState(game, 1).hand;
  const [removed] = hand.splice(handIndex, 1);
  return removed ?? null;
}

function pushPlayedEventToDiscard(game: PuzzleGameState, player: PlayerId, cardId: string): void {
  getPlayerState(game, player).discard.unshift({
    cardId,
    playId: newPlayId(game),
    owner: player,
    controller: player,
    turnDiscarded: game.currentRound,
    discardEffect: "TTFREE",
  });
}

function addUnitToArena(game: PuzzleGameState, player: PlayerId, cardId: string, ready: boolean, linkedLeader = false): PuzzleUnit {
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

function handlePlayCard(runtime: PuzzleRuntime, handIndex: number): PuzzleRuntime {
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
    const readyUnits = getAllUnits(next.game).filter((unit) => unit.controller === 1 && unit.ready);
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
    const readyRebels = getAllUnits(next.game).filter((unit) => unit.controller === 1 && unit.ready && hasTrait(unit.cardId, "Rebel"));
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

    const readyUnits = getAllUnits(next.game).filter((unit) => unit.controller === 1 && unit.ready);
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

function handleLeaderClick(runtime: PuzzleRuntime): PuzzleRuntime {
  if (runtime.status !== "playing" || runtime.prompt || runtime.game.player1.leader.deployed) {
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

function handleUnitClick(runtime: PuzzleRuntime, playId: string): PuzzleRuntime {
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
    logMessage(next, `Rebellious Hammerhead dealt ${prompt.damage} damage to ${CardTitle(clickedUnit.cardId) ?? clickedUnit.cardId}.`);
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
    if (!legalTargets.some((target) => target.type === "unit" && target.playId === clickedUnit.playId)) {
      return runtime;
    }

    return resolveAttack(runtime, attacker.playId, { type: "unit", playId: clickedUnit.playId }, prompt);
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

function handleBaseClick(runtime: PuzzleRuntime, player: PlayerId): PuzzleRuntime {
  if (runtime.status !== "playing" || !runtime.prompt || runtime.prompt.kind !== "attack-target") {
    return runtime;
  }

  const attacker = getUnitByPlayId(runtime.game, runtime.prompt.attackerPlayId);
  if (!attacker) {
    return runtime;
  }

  const legalTargets = getAttackTargets(runtime.game, attacker, runtime.prompt.saboteur);
  if (!legalTargets.some((target) => target.type === "base" && target.player === player)) {
    return runtime;
  }

  return resolveAttack(runtime, attacker.playId, { type: "base", player }, runtime.prompt);
}

function handlePromptOption(runtime: PuzzleRuntime, optionId: string): PuzzleRuntime {
  const prompt = runtime.prompt;
  if (!prompt) {
    return runtime;
  }

  if (prompt.kind === "leader-choice") {
    if (optionId === "ability") {
      return performLeaderAbility(runtime);
    }
    if (optionId === "deploy") {
      return performLeaderDeploy(runtime);
    }
    return runtime;
  }

  if (prompt.kind === "hammerhead-target") {
    if (optionId === "skip") {
      return {
        ...runtime,
        prompt: null,
      };
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

function handlePass(runtime: PuzzleRuntime): PuzzleRuntime {
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

function handleTakeInitiative(runtime: PuzzleRuntime): PuzzleRuntime {
  if (runtime.status !== "playing" || runtime.prompt || runtime.game.initiativeClaimed) {
    return runtime;
  }

  const next = withSnapshot(runtime);
  next.game.initiativeClaimed = true;
  next.game.initiativePlayer = 1;
  logMessage(next, "Player 1 took the initiative.");
  return next;
}

export function reducePuzzle(runtime: PuzzleRuntime, intent: PuzzleIntent): PuzzleRuntime {
  if (intent.type === "reset") {
    return createPuzzleRuntime();
  }

  if (intent.type === "undo") {
    const previous = runtime.history[runtime.history.length - 1];
    if (!previous) {
      return runtime;
    }

    return {
      game: cloneGame(previous.game),
      history: runtime.history.slice(0, -1),
      log: [...previous.log, "Player 1 requested undo."],
      status: previous.status,
      prompt: previous.prompt ? cloneGame(previous.prompt) : null,
    };
  }

  switch (intent.type) {
    case "click-hand":
      return handlePlayCard(runtime, intent.handIndex);
    case "click-leader":
      return intent.player === 1 ? handleLeaderClick(runtime) : runtime;
    case "click-unit":
      return handleUnitClick(runtime, intent.playId);
    case "click-base":
      return handleBaseClick(runtime, intent.player);
    case "choose-option":
      return handlePromptOption(runtime, intent.optionId);
    case "pass":
      return handlePass(runtime);
    case "take-initiative":
      return handleTakeInitiative(runtime);
    default:
      return runtime;
  }
}

export function getPromptOptions(runtime: PuzzleRuntime): Array<{ id: string; label: string; disabled?: boolean }> {
  const prompt = runtime.prompt;
  if (!prompt) {
    return [];
  }

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
    return [
      { id: "base-damage", label: "Deal 3 damage to enemy base" },
      {
        id: "discard-card",
        label: "Enemy discards a card",
        disabled: getPlayerState(runtime.game, prompt.targetPlayer).hand.length === 0,
      },
    ];
  }

  return [];
}

export function canClickHandCard(runtime: PuzzleRuntime, handIndex: number): boolean {
  if (runtime.status !== "playing" || runtime.prompt) {
    return false;
  }

  const card = getHandCard(runtime.game, handIndex);
  return !!card && canAffordCard(runtime.game, 1, card.cardId);
}

export function canClickLeader(runtime: PuzzleRuntime, player: PlayerId): boolean {
  if (player !== 1 || runtime.status !== "playing") {
    return false;
  }

  if (runtime.prompt) {
    return false;
  }

  return canLeaderUseAbility(runtime.game, 1) || canLeaderDeploy(runtime.game, 1);
}

export function canClickUnit(runtime: PuzzleRuntime, playId: string): boolean {
  const unit = getUnitByPlayId(runtime.game, playId);
  if (!unit || runtime.status !== "playing") {
    return false;
  }

  const prompt = runtime.prompt;
  if (!prompt) {
    return unit.controller === 1 && unit.ready;
  }

  if (prompt.kind === "hammerhead-target") {
    return true;
  }

  if (prompt.kind === "attack-attacker") {
    return unit.controller === 1
      && unit.ready
      && (!prompt.attackerTrait || hasTrait(unit.cardId, prompt.attackerTrait))
      && (!prompt.mustBeDifferentFrom || prompt.mustBeDifferentFrom !== unit.playId);
  }

  if (prompt.kind === "attack-target") {
    const attacker = getUnitByPlayId(runtime.game, prompt.attackerPlayId);
    if (!attacker) {
      return false;
    }

    return getAttackTargets(runtime.game, attacker, prompt.saboteur).some((target) => target.type === "unit" && target.playId === playId);
  }

  return false;
}

export function canClickBase(runtime: PuzzleRuntime, player: PlayerId): boolean {
  if (runtime.status !== "playing" || runtime.prompt?.kind !== "attack-target") {
    return false;
  }

  const attacker = getUnitByPlayId(runtime.game, runtime.prompt.attackerPlayId);
  if (!attacker) {
    return false;
  }

  return getAttackTargets(runtime.game, attacker, runtime.prompt.saboteur).some((target) => target.type === "base" && target.player === player);
}

export function getLatestDiscard(game: PuzzleGameState, player: PlayerId): PuzzleDiscard | null {
  return getPlayerState(game, player).discard[0] ?? null;
}

export function getDisplayedPower(unit: PuzzleUnit, runtime: PuzzleRuntime): number {
  const prompt = runtime.prompt;
  if (prompt?.kind === "attack-target" && prompt.attackerPlayId === unit.playId) {
    return getUnitCurrentPower(unit, { attacking: true, powerBonus: prompt.powerBonus });
  }

  return getUnitCurrentPower(unit);
}

export function getDisplayedHp(unit: PuzzleUnit): number {
  return getUnitCurrentHp(unit);
}

export function getCardName(cardId: string): string {
  const title = CardTitle(cardId) ?? cardId;
  const subtitle = CardSubtitle(cardId);
  return subtitle ? `${title} — ${subtitle}` : title;
}

export function getCardCostForDisplay(game: PuzzleGameState, cardId: string, player: PlayerId): number {
  return getCardPlayCost(game, player, cardId);
}
