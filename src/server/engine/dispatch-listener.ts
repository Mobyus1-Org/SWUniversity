/**
 * Engine dispatch listener — the single entry point for the game engine.
 *
 * processDispatch() accepts a GameDispatch and an EngineContext, runs the
 * appropriate game logic, and returns a DispatchResponse plus an updated
 * EngineContext for the caller to persist between requests.
 *
 * No UI-specific concepts (status strings, prompt objects) live here.
 * Game-over state is derived from GameState.defeatedPlayers.
 * Pending input state is tracked in EngineContext.pending (server-only).
 */

import { randomUUID } from "crypto";

import {
  CardArena,
  CardAspects,
  CardCost,
  CardHasWhenPlayed,
  CardHp,
  CardTitle,
  CardType,
} from "./card-db/generated";
import { HasOverwhelm } from "./card-db/keyword-dictionaries.ts/overwhelm";
import { HasSentinel } from "./card-db/keyword-dictionaries.ts/sentinel";
import { GetGame, SetGame } from "./core-functions";
import { Unit } from "./unit";

import type {
  ChooseTargetDispatchData,
  DispatchResponse,
  GameDispatch,
  InitiateAttackDispatchData,
  NeedsOption,
  NeedsTarget,
  PlayCardDispatchData,
  ResolutionRequest,
  UseAbilityDispatchData,
} from "@/lib/engine/message-types";
import type { Game, GameState, PlayerState } from "@/lib/engine/game";
import type { DiscardedCard, PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";
import type {
  AbilityTargetPending,
  AttackTargetPending,
  EngineContext,
  PendingResolution,
} from "./pending-resolution";
import { resolveWhenDefeated } from "./actions/when-defeated";
import { resolveWhenPlayed } from "./actions/when-played";
import { resolveWhenPlayedTrigger } from "./actions/when-played-trigger";
import { resolveOnAttack } from "./actions/on-attack";
import { HasSaboteur } from "./card-db/keyword-dictionaries.ts/saboteur";
import { ActionAbilities } from "./actions/action-ability";

// ---------------------------------------------------------------------------
// Helpers: hydration (plain objects → Unit class instances)
// ---------------------------------------------------------------------------

function hydrateGame(game: Game): void {
  const hydrate = (units: UnitInterface[]) => units.map((u) => Unit.FromInterface(u));
  const g = game.currentGameState;
  g.player1.groundArena = hydrate(g.player1.groundArena);
  g.player1.spaceArena = hydrate(g.player1.spaceArena);
  g.player2.groundArena = hydrate(g.player2.groundArena);
  g.player2.spaceArena = hydrate(g.player2.spaceArena);
}

// ---------------------------------------------------------------------------
// Helpers: game state accessors
// ---------------------------------------------------------------------------

function ps(game: GameState, player: PlayerId): PlayerState {
  return player === 1 ? game.player1 : game.player2;
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 1 ? 2 : 1;
}

function allUnits(game: GameState): Unit[] {
  return [
    ...game.player1.groundArena,
    ...game.player1.spaceArena,
    ...game.player2.groundArena,
    ...game.player2.spaceArena,
  ] as Unit[];
}

function unitByPlayId(game: GameState, playId: string): Unit | null {
  return allUnits(game).find((u) => u.playId === playId) ?? null;
}

// ---------------------------------------------------------------------------
// Helpers: resources & cost
// ---------------------------------------------------------------------------

function aspectPenalty(game: GameState, player: PlayerId, cardId: string): number {
  const playerState = ps(game, player);
  const provided = [
    ...CardAspects(playerState.base.cardId),
    ...CardAspects(playerState.leader.cardId),
  ];
  const counts = new Map<string, number>();
  for (const a of provided) counts.set(a, (counts.get(a) ?? 0) + 1);
  let missing = 0;
  for (const a of CardAspects(cardId)) {
    const rem = counts.get(a) ?? 0;
    if (rem > 0) counts.set(a, rem - 1);
    else missing++;
  }
  return missing * 2;
}

function playCost(game: GameState, player: PlayerId, cardId: string): number {
  return CardCost(cardId)
    + aspectPenalty(game, player, cardId)
  ;
}

function canAfford(game: GameState, player: PlayerId, cardId: string): boolean {
  const ready = ps(game, player).resources.filter((r) => r.ready).length;
  return ready >= playCost(game, player, cardId);
}

function exhaustResources(game: GameState, player: PlayerId, count: number): void {
  let remaining = count;
  for (const r of ps(game, player).resources) {
    if (remaining <= 0) break;
    if (r.ready) {
      r.ready = false;
      remaining--;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers: arena mutations
// ---------------------------------------------------------------------------

function nextPlayId(game: GameState): string {
  return String(game.nextPlayId++);
}

function addToArena(
  game: GameState,
  player: PlayerId,
  cardId: string,
  ready: boolean,
  isClone = false,
): Unit {
  const unit = Unit.FromInterface({
    cardId,
    playId: nextPlayId(game),
    owner: player,
    controller: player,
    ready,
    damage: 0,
    upgrades: [],
    captives: [],
    numUses: 1,
    isClone,
  });
  const arena = (CardArena(cardId) ?? "Ground") as "Ground" | "Space";
  if (arena === "Ground") ps(game, player).groundArena.push(unit);
  else ps(game, player).spaceArena.push(unit);
  return unit;
}

function removeFromArena(
  game: GameState,
  playId: string,
): { player: PlayerId; unit: Unit } | null {
  for (const player of [1, 2] as PlayerId[]) {
    const p = ps(game, player);
    for (const zone of ["groundArena", "spaceArena"] as const) {
      const idx = p[zone].findIndex((u) => u.playId === playId);
      if (idx !== -1) {
        const [unit] = p[zone].splice(idx, 1);
        return { player, unit: unit as Unit };
      }
    }
  }
  return null;
}

function pushToDiscard(game: GameState, player: PlayerId, unit: Unit): void {
  const discarded: DiscardedCard = {
    cardId: unit.cardId,
    playId: unit.playId,
    owner: unit.owner,
    controller: unit.owner,
    turnDiscarded: game.currentRound,
    discardEffect: "",
  };
  ps(game, player).discard.unshift(discarded);
}

function pushEventToDiscard(game: GameState, player: PlayerId, cardId: string): void {
  const discarded: DiscardedCard = {
    cardId,
    playId: nextPlayId(game),
    owner: player,
    controller: player,
    turnDiscarded: game.currentRound,
    discardEffect: "",
  };
  ps(game, player).discard.unshift(discarded);
}

function dealBaseDamage(game: GameState, player: PlayerId, amount: number): void {
  ps(game, player).base.damage += amount;
}

/**
 * Drains the trigger bag after an action resolves.
 * - 0 triggers: no-op
 * - 1 trigger: auto-resolve without player input
 * - 2+ triggers: (future) will need player ordering — no-op for now
 */
function drainTriggerBag(game: GameState, log: string[]): void {
  if (game.triggerBag.length === 1) {
    const [trigger] = game.triggerBag.splice(0, 1);
    if (trigger.triggerType === "when-played") {
      resolveWhenPlayedTrigger(trigger, game, log);
    }
  }
}

function updateDefeatedPlayers(game: GameState): void {
  const p1Max = CardHp(game.player1.base.cardId) || 30;
  const p2Max = CardHp(game.player2.base.cardId) || 30;
  game.defeatedPlayers = [];
  if (game.player1.base.damage >= p1Max) game.defeatedPlayers.push(1);
  if (game.player2.base.damage >= p2Max) game.defeatedPlayers.push(2);
}

// ---------------------------------------------------------------------------
// Helpers: defeat a unit (arena → discard / leader zone)
// ---------------------------------------------------------------------------

function defeatUnit(
  game: GameState,
  log: string[],
  unit: Unit,
): PendingResolution | null {
  const removed = removeFromArena(game, unit.playId);
  if (!removed) return null;

  if (CardType(unit.cardId) === "Leader") {
    const leader = ps(game, removed.player).leader;
    leader.deployed = false;
    leader.ready = false;
    leader.deployedPlayId = undefined;
    log.push(
      `${CardTitle(unit.cardId)} was defeated and returned to the leader zone.`,
    );
    return null;
  }

  pushToDiscard(game, removed.player, unit);
  log.push(`${CardTitle(unit.cardId)} was defeated.`);

  // When-Defeated triggers: add card-specific entries to whenDefeatedRegistry below.
  return resolveWhenDefeated(unit, removed.player);
}

// ---------------------------------------------------------------------------
// Helpers: attack target computation
// ---------------------------------------------------------------------------

function computeAttackTargets(
  game: GameState,
  attacker: Unit
): { unitPlayIds: string[]; includesBase: boolean } {
  const arena = (CardArena(attacker.cardId) ?? "Ground") as "Ground" | "Space";
  const defenderPlayer = otherPlayer(attacker.controller);
  const p = ps(game, defenderPlayer);
  const opposing = (arena === "Ground" ? p.groundArena : p.spaceArena) as Unit[];

  const sentinels = opposing.filter((u) => {
    try {
      return HasSentinel(u.cardId, u.playId, u.controller);
    } catch {
      return false;
    }
  });

  if (sentinels.length > 0 && !HasSaboteur(attacker.cardId, attacker.playId, attacker.controller)) {
    return { unitPlayIds: sentinels.map((u) => u.playId), includesBase: false };
  }
  return { unitPlayIds: opposing.map((u) => u.playId), includesBase: true };
}

// ---------------------------------------------------------------------------
// Helpers: resolve combat
// ---------------------------------------------------------------------------

function resolveAttack(
  game: GameState,
  log: string[],
  pending: AttackTargetPending,
  target:
    | { type: "unit"; playId: string }
    | { type: "base"; player: PlayerId },
): PendingResolution | null {
  const attacker = unitByPlayId(game, pending.attackerPlayId);
  if (!attacker) return null;

  attacker.ready = false;
  const atkPower = attacker.CurrentPower();
  const attackerName = CardTitle(attacker.cardId);

  if (target.type === "base") {
    dealBaseDamage(game, target.player, atkPower);
    log.push(`${attackerName} attacked the base for ${atkPower} damage.`);
  } else {
    const defender = unitByPlayId(game, target.playId);
    if (!defender) return null;

    const defPower = defender.CurrentPower();
    const defHpBefore = defender.CurrentHP();
    const defenderName = CardTitle(defender.cardId);

    defender.damage += atkPower;
    attacker.damage += defPower;
    log.push(`${attackerName} attacked ${defenderName}.`);

    // Overwhelm: excess damage spills to base
    try {
      if (
        HasOverwhelm(
          attacker.cardId,
          attacker.playId,
          attacker.controller,
          defender.playId,
          defender.controller,
        )
      ) {
        const excess = Math.max(atkPower - defHpBefore, 0);
        if (excess > 0) {
          dealBaseDamage(game, otherPlayer(attacker.controller), excess);
          log.push(`Overwhelm: ${excess} excess damage dealt to the base.`);
        }
      }
    } catch {
      // HasOverwhelm may throw if unit isn't in singleton; ignore safely
    }

    const defDefeated = defender.CurrentHP() <= 0;
    const atkDefeated = attacker.CurrentHP() <= 0;

    // Resolve defeats (defender first per SWU rules)
    let nextPending: PendingResolution | null = null;
    if (defDefeated) nextPending = defeatUnit(game, log, defender) ?? nextPending;
    if (atkDefeated) nextPending = defeatUnit(game, log, attacker) ?? nextPending;
    if (nextPending) return nextPending;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

function invalidResponse(reason: string): DispatchResponse {
  return { dispatchResponseId: randomUUID(), invalidAction: true, invalidReason: reason };
}

function stateResponse(game: GameState): DispatchResponse {
  return { dispatchResponseId: randomUUID(), newGameState: game };
}

function resolutionResponse(resolution: ResolutionRequest): DispatchResponse {
  return { dispatchResponseId: randomUUID(), resolutionNeeded: resolution };
}

// ---------------------------------------------------------------------------
// Build public ResolutionRequest from internal pending state
// ---------------------------------------------------------------------------

function pendingToResolution(pending: PendingResolution, game: GameState): ResolutionRequest {
  switch (pending.type) {
    case "attack-target": {
      const attacker = unitByPlayId(game, pending.attackerPlayId);
      if (!attacker) return { type: "Target" } satisfies NeedsTarget;
      const { unitPlayIds, includesBase } = computeAttackTargets(
        game,
        attacker,
      );
      return {
        type: "Target",
        fromPlayIds: unitPlayIds.length > 0 ? unitPlayIds : undefined,
        fromZones: includesBase ? ["Base"] : undefined,
      } satisfies NeedsTarget;
    }
    case "ability-option":
      return { type: "Option", helperText: pending.helperText } satisfies NeedsOption;
    case "ability-target":
      return {
        type: "Target",
        fromPlayIds: pending.fromPlayIds.length > 0 ? pending.fromPlayIds : undefined,
        fromZones: ["Base"],
      } satisfies NeedsTarget;
    case "leader-action":
      return { type: "Option", helperText: "Choose: use leader ability or deploy leader." } satisfies NeedsOption;
    case "when-defeated-choice":
      return {
        type: "Option",
        helperText: `Choose When Defeated effect for ${CardTitle(pending.defeatedCardId)}.`,
      } satisfies NeedsOption;
  }
}

// ---------------------------------------------------------------------------
// Internal result type
// ---------------------------------------------------------------------------

interface HandlerResult {
  response: DispatchResponse;
  pending: PendingResolution | null;
  /** True when an irreversible game state change occurred (snapshot history). */
  stateChanged: boolean;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handlePlayCard(
  game: GameState,
  log: string[],
  dispatch: GameDispatch,
): HandlerResult {
  const { cardId } = dispatch.dispatchData as PlayCardDispatchData;
  const player = dispatch.fromPlayer;
  const hand = ps(game, player).hand;
  const idx = hand.findIndex((c) => c.cardId === cardId);

  if (idx === -1)
    return { response: invalidResponse(`Card ${cardId} not found in Player ${player}'s hand.`), pending: null, stateChanged: false };
  if (!canAfford(game, player, cardId))
    return { response: invalidResponse(`Player ${player} cannot afford ${cardId}.`), pending: null, stateChanged: false };

  const cost = playCost(game, player, cardId);
  exhaustResources(game, player, cost);
  hand.splice(idx, 1);
  log.push(`Player ${player} played ${CardTitle(cardId) ?? cardId}.`);

  if (CardType(cardId) === "Unit") {
    const unit = addToArena(game, player, cardId, false);
    log.push(`${CardTitle(cardId) ?? cardId} entered the ${CardArena(cardId) ?? "ground"} arena.`);

    // Optional when-played abilities (e.g. "you may") use the pending resolution flow.
    // Auto-trigger when-played abilities (no user input needed) go through the trigger bag.
    const nextPending = resolveWhenPlayed(unit.cardId, player, unit.playId);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    if (CardHasWhenPlayed(unit.cardId)) {
      game.triggerBag.push({ triggerType: "when-played", cardId: unit.cardId, fromPlayer: player });
    }
  } else {
    pushEventToDiscard(game, player, cardId);
    log.push(`${CardTitle(cardId) ?? cardId} resolved and placed in the discard.`);

    const nextPending = resolveWhenPlayed(cardId, player);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
  }

  drainTriggerBag(game, log);
  updateDefeatedPlayers(game);
  return { response: stateResponse(game), pending: null, stateChanged: true };
}

function handleInitiateAttack(
  game: GameState,
  log: string[],
  dispatch: GameDispatch,
): HandlerResult {
  const { playId } = dispatch.dispatchData as InitiateAttackDispatchData;
  const player = dispatch.fromPlayer;

  const attacker = unitByPlayId(game, playId);
  if (!attacker)
    return { response: invalidResponse(`No unit with playId ${playId}.`), pending: null, stateChanged: false };
  if (attacker.controller !== player)
    return { response: invalidResponse(`Unit ${playId} is not controlled by Player ${player}.`), pending: null, stateChanged: false };
  if (!attacker.ready)
    return { response: invalidResponse(`Unit ${playId} is exhausted.`), pending: null, stateChanged: false };

  // Check for optional On Attack abilities before picking the attack target
  const onAttackPending = resolveOnAttack(attacker);
  if (onAttackPending) {
    return { response: resolutionResponse(pendingToResolution(onAttackPending, game)), pending: onAttackPending, stateChanged: false };
  }

  // No On Attack ability — ask for attack target directly
  const attackPending: AttackTargetPending = {
    type: "attack-target",
    attackerPlayId: playId,
    source: "normal-attack",
  };
  const { unitPlayIds, includesBase } = computeAttackTargets(game, attacker);
  return {
    response: resolutionResponse({
      type: "Target",
      fromPlayIds: unitPlayIds.length > 0 ? unitPlayIds : undefined,
      fromZones: includesBase ? ["Base"] : undefined,
    }),
    pending: attackPending,
    stateChanged: false,
  };
}

function handleUseAbility(
  game: GameState,
  log: string[],
  dispatch: GameDispatch,
): HandlerResult {
  const data = dispatch.dispatchData as UseAbilityDispatchData;
  const player = dispatch.fromPlayer;
  const leader = ps(game, player).leader;

  // Leader card: deploy or use ability
  if (leader.cardId === data.cardId) {
    if (leader.deployed)
      return { response: invalidResponse("Leader is already deployed as a unit."), pending: null, stateChanged: false };

    // Deploy via epic action
    if (data.deployLeader) {
      return deployLeader(game, log, player);
    }

    // Use leader ability
    if (!leader.ready)
      return { response: invalidResponse("Leader is exhausted."), pending: null, stateChanged: false };

    const abilities = ActionAbilities(leader.cardId, player);
    if (!abilities.includes(leader.cardId))
      return { response: invalidResponse("Leader has no available ability."), pending: null, stateChanged: false };

    leader.ready = false;
    const nextPending = resolveActionAbility(game, log, player, leader.cardId);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  // Unit action ability
  if (data.playId) {
    const unit = unitByPlayId(game, data.playId);
    if (!unit)
      return { response: invalidResponse(`No unit with playId ${data.playId}.`), pending: null, stateChanged: false };
    if (unit.controller !== player)
      return { response: invalidResponse(`Unit ${data.playId} is not controlled by Player ${player}.`), pending: null, stateChanged: false };

    const nextPending = resolveActionAbility(game, log, player, unit.cardId, unit.playId);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  return { response: invalidResponse("use-ability requires a leader cardId or a unit playId."), pending: null, stateChanged: false };
}

function handleChooseTarget(
  game: GameState,
  log: string[],
  dispatch: GameDispatch,
  pending: PendingResolution | null,
): HandlerResult {
  if (!pending)
    return { response: invalidResponse("No pending action to resolve."), pending: null, stateChanged: false };

  const data = dispatch.dispatchData as ChooseTargetDispatchData;

  // Attack target
  if (pending.type === "attack-target") {
    let target: { type: "unit"; playId: string } | { type: "base"; player: PlayerId } | null =
      null;

    if (data.targetZones?.includes("Base")) {
      const atkController = unitByPlayId(game, pending.attackerPlayId)?.controller;
      if (atkController != null) target = { type: "base", player: otherPlayer(atkController) };
    } else if (data.targetPlayIds?.[0]) {
      const chosen = data.targetPlayIds[0];
      const attacker = unitByPlayId(game, pending.attackerPlayId);
      if (!attacker)
        return { response: invalidResponse("Attacker no longer in play."), pending: null, stateChanged: false };
      const { unitPlayIds } = computeAttackTargets(game, attacker);
      if (!unitPlayIds.includes(chosen))
        return { response: invalidResponse(`Unit ${chosen} is not a legal attack target.`), pending, stateChanged: false };
      target = { type: "unit", playId: chosen };
    }

    if (!target)
      return { response: invalidResponse("choose-target must include targetPlayIds or targetZones containing 'Base'."), pending, stateChanged: false };

    const nextPending = resolveAttack(game, log, pending, target);
    updateDefeatedPlayers(game);

    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  // Ability target
  if (pending.type === "ability-target") {
    const chosen = data.targetPlayIds?.[0];
    const chosenBase = data.targetZones?.includes("Base") ?? false;

    if (!chosen && !chosenBase)
      return { response: invalidResponse("choose-target must include targetPlayIds or targetZones."), pending, stateChanged: false };
    if (chosen && pending.fromPlayIds.length > 0 && !pending.fromPlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid ability target.`), pending, stateChanged: false };

    const nextPending = applyAbilityEffect(pending, chosenBase, chosen);
    updateDefeatedPlayers(game);

    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  return { response: invalidResponse(`choose-target is not valid while pending: ${pending.type}.`), pending, stateChanged: false };
}

function handleChooseYes(
  game: GameState,
  log: string[],
  pending: PendingResolution | null,
): HandlerResult {
  if (pending?.type === "ability-option") {
    if (pending.onYes) {
      return { response: resolutionResponse(pendingToResolution(pending.onYes, game)), pending: pending.onYes, stateChanged: false };
    }
    if (pending.continuation) {
      return { response: resolutionResponse(pendingToResolution(pending.continuation, game)), pending: pending.continuation, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }
  if (pending?.type === "leader-action") {
    return resolveLeaderAbility(game, log, pending.player);
  }
  return { response: invalidResponse("No pending yes/no decision."), pending: null, stateChanged: false };
}

function handleChooseNo(
  game: GameState,
  log: string[],
  pending: PendingResolution | null,
): HandlerResult {
  if (pending?.type === "ability-option") {
    log.push(`Player skipped optional ability for ${CardTitle(pending.cardId) ?? pending.cardId}.`);
    if (pending.continuation) {
      return { response: resolutionResponse(pendingToResolution(pending.continuation, game)), pending: pending.continuation, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }
  if (pending?.type === "leader-action") {
    return deployLeader(game, log, pending.player);
  }
  return { response: invalidResponse("No pending yes/no decision."), pending: null, stateChanged: false };
}

function handlePassAction(game: GameState, log: string[], dispatch: GameDispatch): HandlerResult {
  log.push(`Player ${dispatch.fromPlayer} passed their action.`);
  return { response: stateResponse(game), pending: null, stateChanged: true };
}

function handleClaimInitiative(game: GameState, log: string[], dispatch: GameDispatch): HandlerResult {
  if (game.initiativeClaimed)
    return { response: invalidResponse("Initiative has already been claimed this round."), pending: null, stateChanged: false };
  game.initiativeClaimed = true;
  game.initiativePlayer = dispatch.fromPlayer;
  log.push(`Player ${dispatch.fromPlayer} claimed initiative.`);
  return { response: stateResponse(game), pending: null, stateChanged: true };
}

// ---------------------------------------------------------------------------
// Leader helpers
// ---------------------------------------------------------------------------

function deployLeader(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const leader = ps(game, player).leader;
  if (leader.deployed)
    return { response: invalidResponse("Leader is already deployed."), pending: null, stateChanged: false };
  if (leader.epicActionUsed)
    return { response: invalidResponse("Leader epic action already used this round."), pending: null, stateChanged: false };
  if (ps(game, player).resources.length < playCost(game, player, leader.cardId))
    return { response: invalidResponse("Not enough resources to deploy leader."), pending: null, stateChanged: false };

  leader.deployed = true;
  leader.epicActionUsed = true;
  const unit = addToArena(game, player, leader.cardId, false);
  leader.deployedPlayId = unit.playId;
  log.push(`Player ${player} deployed ${CardTitle(leader.cardId) ?? leader.cardId}.`);
  updateDefeatedPlayers(game);
  return { response: stateResponse(game), pending: null, stateChanged: true };
}

function resolveLeaderAbility(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const leader = ps(game, player).leader;
  leader.ready = false;
  const nextPending = resolveActionAbility(game, log, player, leader.cardId);
  if (nextPending) {
    return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
  }
  updateDefeatedPlayers(game);
  return { response: stateResponse(game), pending: null, stateChanged: true };
}

// ---------------------------------------------------------------------------
// Card ability registries — extension points for card-specific behaviour.
// Add a case per cardId. These are the ONLY places card IDs should appear.
// ---------------------------------------------------------------------------

/**
 * Resolves action abilities for both leaders (non-deployed) and deployed units.
 * The leader is already exhausted before this is called.
 */
function resolveActionAbility(
  game: GameState,
  log: string[],
  player: PlayerId,
  cardId: string,
  playId?: string,
): PendingResolution | null {
  switch (cardId) {
    case "SOR_014": // Sabine Wren - Galvanized Revolutionary: Deal 1 damage to each base.
      game.player1.base.damage += 1;
      game.player2.base.damage += 1;
      log.push(`${CardTitle(cardId)} dealt 1 damage to each base.`);
      return null;
    default:
      return null;
  }
}

/**
 * Applies an ability effect once the player has selected a target.
 * Returns the next pending state if further input is required.
 */
function applyAbilityEffect(
  pending: AbilityTargetPending,
  targetIsBase: boolean,
  targetPlayId?: string,
): PendingResolution | null {
  const game = GetGame();
  if(!game) throw new Error("Game not found in applyAbilityEffect.");
  switch (pending.cardId) {
    case "JTL_153": { // Rebellious Hammerhead: deal damage equal to hand size to chosen unit
      const sourceUnit = unitByPlayId(game.currentGameState, pending.sourcePlayId!);
      if (!sourceUnit) break;
      const owner = sourceUnit.controller;
      const handSize = ps(game.currentGameState, owner).hand.length;
      const target = targetPlayId ? unitByPlayId(game.currentGameState, targetPlayId) : null;
      if (target) {
        target.damage += handSize;
        game.gameLog.push(`${CardTitle(pending.cardId)} dealt ${handSize} damage to ${CardTitle(target.cardId) ?? target.cardId}.`);
      }
      break;
    }
    default:
      game.gameLog.push(`Ability effect for ${CardTitle(pending.cardId) ?? pending.cardId} applied.`);
      break;
  }
  return pending.continuation;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Process one GameDispatch message against the current EngineContext.
 *
 * The caller must store the returned context and send it back on the next
 * request. The context is opaque to the UI — it carries pending resolution
 * state and the full game object.
 */
export function processDispatch(
  dispatch: GameDispatch,
  context: EngineContext,
): { response: DispatchResponse; context: EngineContext } {
  // 1. Deep-clone so callers' objects are never mutated
  const game: Game = structuredClone(context.game);
  const log = game.gameLog;
  const gs = game.currentGameState;

  // 2. Hydrate unit arrays to Unit class instances (keyword dicts need methods)
  hydrateGame(game);

  // 3. Activate the game singleton (required by keyword dictionary functions)
  SetGame(game);

  try {
    const pending = context.pending;
    let result: HandlerResult;

    switch (dispatch.dispatchType) {
      case "play-card":         result = handlePlayCard(gs, log, dispatch); break;
      case "initiate-attack":   result = handleInitiateAttack(gs, log, dispatch); break;
      case "use-ability":       result = handleUseAbility(gs, log, dispatch); break;
      case "pass-action":       result = handlePassAction(gs, log, dispatch); break;
      case "claim-initiative":  result = handleClaimInitiative(gs, log, dispatch); break;
      case "choose-target":     result = handleChooseTarget(gs, log, dispatch, pending); break;
      case "choose-yes":        result = handleChooseYes(gs, log, pending); break;
      case "choose-no":         result = handleChooseNo(gs, log, pending); break;
      case "choose-player":
      case "choose-trigger":
        // Reserved for future trigger-bag resolution
        result = { response: invalidResponse(`${dispatch.dispatchType} not yet implemented.`), pending, stateChanged: false };
        break;
      default:
        result = { response: invalidResponse(`Unknown dispatch type.`), pending: null, stateChanged: false };
    }

    const updatedGame: Game = {
      id: game.id,
      currentGameState: gs,
      gameStateHistory: result.stateChanged
        ? [...context.game.gameStateHistory, context.game.currentGameState]
        : context.game.gameStateHistory,
      gameLog: log,
    };

    return {
      response: result.response,
      context: { game: updatedGame, pending: result.pending },
    };
  } finally {
    SetGame(null);
  }
}
