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
} from "@/server/engine/card-db/generated";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { CardIsLeader, GetGame, GetUnitsForPlayer, SetGame, TraitContains } from "@/server/engine/core-functions";
import { Unit } from "@/server/engine/unit";

import type {
  ChooseOptionDispatchData,
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
import type { CardInPlay, DiscardedCard, PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";
import type {
  AbilityTargetPending,
  AttackTargetPending,
  DiscardFromHandPending,
  EngineContext,
  PendingResolution,
  ResolveAttackPending,
  UpgradeTargetPending,
} from "@/server/engine/pending-resolution";
import { resolveWhenDefeated } from "@/server/engine/actions/when-defeated";
import { UpgradeEligibleTargets } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { resolveWhenPlayed } from "@/server/engine/actions/when-played";
import { resolveWhenPlayedTrigger } from "@/server/engine/actions/when-played-trigger";
import { resolveOnAttackTrigger } from "@/server/engine/actions/on-attack";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

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

/**
 * Drain on-attack triggers from the bag after the attack target is locked in.
 * Returns a PendingResolution if the trigger requires player input (with
 * combat queued as continuation), or null if no on-attack triggers are present.
 */
function drainOnAttackTriggerBag(
  game: GameState,
  attacker: Unit,
  continuation: ResolveAttackPending,
): PendingResolution | null {
  const onAttackTriggers = game.triggerBag.filter(t => t.triggerType === "on-attack");
  if (onAttackTriggers.length === 0) return null;

  if (onAttackTriggers.length === 1) {
    const triggerIndex = game.triggerBag.indexOf(onAttackTriggers[0]);
    game.triggerBag.splice(triggerIndex, 1);
    return resolveOnAttackTrigger(attacker, continuation);
  }

  // 2+ triggers: ordering needed (future) — skip for now
  return null;
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

  if (CardIsLeader(unit.cardId)) {
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
  const atkPower = attacker.CurrentPower(false, true);
  const attackerName = CardTitle(attacker.cardId);

  if (target.type === "base") {
    dealBaseDamage(game, target.player, atkPower);
    log.push(`${attackerName} attacked the base for ${atkPower} damage.`);
    // Clear ForAttack effects scoped to this attacker after the attack resolves
    game.currentEffects = game.currentEffects.filter(
      (e) => !(e.duration === "ForAttack" && e.targetPlayId === attacker.playId),
    );
    return resolveWhenAttackEnds(game, attacker, pending.continuation ?? null);
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

    // Clear ForAttack effects scoped to this attacker after the attack resolves
    game.currentEffects = game.currentEffects.filter(
      (e) => !(e.duration === "ForAttack" && e.targetPlayId === attacker.playId),
    );

    // Resolve defeats (defender first per SWU rules)
    let nextPending: PendingResolution | null = null;
    if (defDefeated) nextPending = defeatUnit(game, log, defender) ?? nextPending;
    if (atkDefeated) nextPending = defeatUnit(game, log, attacker) ?? nextPending;
    if (nextPending && nextPending.type === "when-defeated-choice") {
      nextPending.continuation = resolveWhenAttackEnds(game, attacker, pending.continuation ?? null);
    }
    if (nextPending) return nextPending;

    return resolveWhenAttackEnds(game, attacker, pending.continuation ?? null);
  }
}

/**
 * Fires after any attack resolves. Returns a PendingResolution if the attacker
 * has a "when this unit completes an attack" ability, otherwise returns continuation.
 */
function resolveWhenAttackEnds(
  game: GameState,
  attacker: Unit,
  continuation: PendingResolution | null,
): PendingResolution | null {
  // If attacker was defeated, no trigger fires
  if (!unitByPlayId(game, attacker.playId)) return continuation;

  switch (attacker.cardId) {
    case "SOR_009": { // Leia Organa: You may attack with another Rebel unit
      const rebelUnits = (GetUnitsForPlayer(attacker.controller) as Unit[])
        .filter(u => u.ready && TraitContains(u.cardId, "Rebel", attacker.controller, u.playId));
      if (rebelUnits.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: "SOR_009",
        helperText: "Attack with another Rebel unit?",
        onYes: {
          type: "ability-target",
          cardId: "SOR_009",
          fromPlayIds: rebelUnits.map(u => u.playId),
          continuation,
        },
        continuation,
      };
    }
    default:
      return continuation;
  }
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
      return { type: "Option", helperText: pending.helperText, options: ["Yes", "No"] } satisfies NeedsOption;
    case "ability-target":
      return {
        type: "Target",
        fromPlayIds: pending.fromPlayIds.length > 0 ? pending.fromPlayIds : undefined,
      } satisfies NeedsTarget;
    case "when-defeated-choice":
      return {
        type: "Option",
        helperText: `Choose When Defeated effect for ${CardTitle(pending.defeatedCardId)}.`,
        options: pending.options,
      } satisfies NeedsOption;
    case "discard-from-hand":
      return { type: "Target", fromZones: ["Hand"] } satisfies NeedsTarget;
    case "upgrade-target":
      return {
        type: "Target",
        fromPlayIds: pending.fromPlayIds.length > 0 ? pending.fromPlayIds : undefined,
      } satisfies NeedsTarget;
    case "resolve-attack":
      // Should never be shown to client — auto-resolves as continuation
      return { type: "Target" } satisfies NeedsTarget;
    default: throw new Error(`Unknown pending resolution type: ${pending.type}`);
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
  } else if (CardType(cardId) === "Upgrade") {
    const eligiblePlayIds = UpgradeEligibleTargets(cardId, game, player);

    const upgradePending: UpgradeTargetPending = {
      type: "upgrade-target",
      upgradeCardId: cardId,
      player,
      fromPlayIds: eligiblePlayIds,
    };
    return { response: resolutionResponse(pendingToResolution(upgradePending, game)), pending: upgradePending, stateChanged: false };
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
  // On-attack triggers go into the bag here; they drain AFTER target is chosen.
  if (["SOR_010", "SOR_014"].includes(attacker.cardId)) {
    game.triggerBag.push({ triggerType: "on-attack", cardId: attacker.cardId, fromPlayer: player });
  }

  // Ask for attack target
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

    const nextPending = resolveActionAbility(game, log, player, unit.cardId);//, unit.playId);
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
    let attacker: Unit | null = null;

    if (data.targetZones?.includes("Base")) {
      const atkController = unitByPlayId(game, pending.attackerPlayId)?.controller;
      if (atkController != null) target = { type: "base", player: otherPlayer(atkController) };
      attacker = unitByPlayId(game, pending.attackerPlayId);
    } else if (data.targetPlayIds?.[0]) {
      const chosen = data.targetPlayIds[0];
      attacker = unitByPlayId(game, pending.attackerPlayId);
      if (!attacker)
        return { response: invalidResponse("Attacker no longer in play."), pending: null, stateChanged: false };
      const { unitPlayIds } = computeAttackTargets(game, attacker);
      if (!unitPlayIds.includes(chosen))
        return { response: invalidResponse(`Unit ${chosen} is not a legal attack target.`), pending, stateChanged: false };
      target = { type: "unit", playId: chosen };
    }

    if (!target)
      return { response: invalidResponse("choose-target must include targetPlayIds or targetZones containing 'Base'."), pending, stateChanged: false };

    // For ability-initiated attacks (e.g. Rebel Assault, Precision Fire), the trigger bag may not
    // have been populated at initiate time, so fill it now if needed.
    if (attacker && ["SOR_010", "SOR_014"].includes(attacker.cardId)) {
      const alreadyQueued = game.triggerBag.some(
        (t) => t.triggerType === "on-attack" && t.cardId === attacker.cardId,
      );
      if (!alreadyQueued) {
        game.triggerBag.push({ triggerType: "on-attack", cardId: attacker.cardId, fromPlayer: attacker.controller });
      }
    }

    // Drain on-attack triggers; if any fire, queue combat as continuation.
    const resolveAttackPending: ResolveAttackPending = {
      type: "resolve-attack",
      attackerPlayId: pending.attackerPlayId,
      target,
      continuation: pending.continuation ?? null,
    };
    const onAttackTriggerPending = attacker
      ? drainOnAttackTriggerBag(game, attacker, resolveAttackPending)
      : null;
    if (onAttackTriggerPending) {
      if (onAttackTriggerPending.type === "resolve-attack") {
        return handleResolveAttack(game, log, onAttackTriggerPending);
      }
      return { response: resolutionResponse(pendingToResolution(onAttackTriggerPending, game)), pending: onAttackTriggerPending, stateChanged: false };
    }

    const nextPending = resolveAttack(game, log, pending, target);
    updateDefeatedPlayers(game);

    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }
  if (pending.type === "ability-target") {
    const chosen = data.targetPlayIds?.[0];
    const chosenBase = data.targetZones?.includes("Base") ?? false;

    if (!chosen && !chosenBase)
      return { response: invalidResponse("choose-target must include targetPlayIds or targetZones."), pending, stateChanged: false };
    if (chosen && pending.fromPlayIds.length > 0 && !pending.fromPlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid ability target.`), pending, stateChanged: false };

    const rawPending = applyAbilityEffect(pending, chosenBase, chosen);
    updateDefeatedPlayers(game);

    if (rawPending?.type === "resolve-attack") {
      return handleResolveAttack(game, log, rawPending);
    }
    if (rawPending) {
      return { response: resolutionResponse(pendingToResolution(rawPending, game)), pending: rawPending, stateChanged: false };
    }
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "discard-from-hand") {
    const idx = data.targetIndices?.[0];
    if (idx == null)
      return { response: invalidResponse("Choose a card index to discard."), pending, stateChanged: false };
    const playerHand = ps(game, pending.targetPlayer).hand;
    if (idx < 0 || idx >= playerHand.length)
      return { response: invalidResponse("Invalid hand index."), pending, stateChanged: false };
    playerHand.splice(idx, 1);
    log.push(`Player ${pending.targetPlayer} discarded a card.`);
    const remaining = pending.count - 1;
    const nextPending: PendingResolution | null = remaining > 0
      ? { type: "discard-from-hand", targetPlayer: pending.targetPlayer, count: remaining, continuation: pending.continuation }
      : (pending.continuation ?? null);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "upgrade-target") {
    const chosen = data.targetPlayIds?.[0];
    if (!chosen)
      return { response: invalidResponse("choose-target must include targetPlayIds for upgrade attachment."), pending, stateChanged: false };
    if (!pending.fromPlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid upgrade target.`), pending, stateChanged: false };

    const targetUnit = unitByPlayId(game, chosen);
    if (!targetUnit)
      return { response: invalidResponse("Target unit not found."), pending, stateChanged: false };

    const upgradeInPlay: CardInPlay = {
      cardId: pending.upgradeCardId,
      playId: nextPlayId(game),
      owner: pending.player,
      controller: pending.player,
    };
    targetUnit.upgrades.push(upgradeInPlay);
    log.push(`${CardTitle(pending.upgradeCardId)} attached to ${CardTitle(targetUnit.cardId)}.`);

    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  return { response: invalidResponse(`choose-target is not valid while pending: ${pending.type}.`), pending, stateChanged: false };
}

function handleChooseOption(
  game: GameState,
  log: string[],
  dispatch: GameDispatch,
  pending: PendingResolution | null,
): HandlerResult {
  const option = (dispatch.dispatchData as ChooseOptionDispatchData).option;

  if (pending?.type === "ability-option") {
    if (option === "Yes") {
      const nextPending = pending.onYes ?? null;
      if (nextPending) {
        return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
      }
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }
    // "No" — skip the ability, return to continuation
    const nextPending = pending.continuation;
    if (nextPending?.type === "resolve-attack") {
      return handleResolveAttack(game, log, nextPending);
    }
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending?.type === "leader-action") {
    return resolveLeaderAbility(game, log, pending.player);
  }

  if (pending?.type === "when-defeated-choice") {
    const eqIdx = option.indexOf("=");
    const optionType = eqIdx >= 0 ? option.slice(0, eqIdx) : option;
    const parts = eqIdx >= 0 ? option.slice(eqIdx + 1).split(",") : [];

    if (optionType === "deal_base_damage") {
      const targetPlayer = Number(parts[0]) as PlayerId;
      const amount = Number(parts[1]);
      dealBaseDamage(game, targetPlayer, amount);
      log.push(`When Defeated: dealt ${amount} damage to Player ${targetPlayer}'s base.`);
      const nextPending = pending.continuation ?? null;
      updateDefeatedPlayers(game);
      if (nextPending) {
        return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
      }
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    if (optionType === "player_discards_from_hand") {
      const targetPlayer = Number(parts[0]) as PlayerId;
      const count = Number(parts[1]);
      const discardPending: DiscardFromHandPending = {
        type: "discard-from-hand",
        targetPlayer,
        count,
        continuation: pending.continuation ?? null,
      };
      return { response: resolutionResponse(pendingToResolution(discardPending, game)), pending: discardPending, stateChanged: false };
    }

    return { response: invalidResponse(`Unknown when-defeated option: ${optionType}`), pending, stateChanged: false };
  }

  return { response: invalidResponse("No pending option decision."), pending: null, stateChanged: false };
}

/**
 * Executes combat for an already-chosen attacker + target, then returns the
 * next pending resolution (e.g. when-defeated triggers, RA continuation).
 * Used as the auto-resolve step after on-attack triggers finish.
 */
function handleResolveAttack(
  game: GameState,
  log: string[],
  pending: ResolveAttackPending,
): HandlerResult {
  const attackPending: AttackTargetPending = {
    type: "attack-target",
    attackerPlayId: pending.attackerPlayId,
    source: "on-attack-resolved",
    continuation: pending.continuation,
  };
  const nextPending = resolveAttack(game, log, attackPending, pending.target);
  updateDefeatedPlayers(game);
  if (nextPending) {
    return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
  }
  return { response: stateResponse(game), pending: null, stateChanged: true };
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
  const unit = addToArena(game, player, leader.cardId, true);
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
  //playId?: string,
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
    case "SOR_010": { // Darth Vader: deal 2 damage to chosen unit
      if (!targetPlayId) break;
      const target = unitByPlayId(game.currentGameState, targetPlayId);
      if (target) {
        target.damage += 2;
        game.gameLog.push(`${CardTitle(pending.cardId)}: dealt 2 damage to ${CardTitle(target.cardId) ?? target.cardId}.`);
      }
      break;
    }
    case "SOR_009": { // Leia Organa: chosen Rebel unit attacks (no buff)
      if (!targetPlayId) break;
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SOR_009",
        continuation: pending.continuation,
      };
    }
    case "SOR_103": { // Rebel Assault: push ForAttack +1 on chosen Rebel unit, then initiate attack with it
      if (!targetPlayId) break;
      const rebelUnit = unitByPlayId(game.currentGameState, targetPlayId);
      if (!rebelUnit) break;
      game.currentGameState.currentEffects.push({
        cardId: "SOR_103",
        duration: "ForAttack",
        affectedPlayer: rebelUnit.controller,
        targetPlayId,
      });
      game.gameLog.push(`${CardTitle(pending.cardId)}: ${CardTitle(rebelUnit.cardId) || targetPlayId} gets +1/+0 for this attack.`);
      // Re-compute continuation targets now, excluding the chosen attacker (it will be exhausted after this attack).
      let continuationSOR103 = pending.continuation;
      if (continuationSOR103?.type === "ability-target") {
        const freshRebelPlayIds = GetUnitsForPlayer(rebelUnit.controller, true)
          .filter(u => u.playId !== targetPlayId && TraitContains(u.cardId, "Rebel", u.controller, u.playId))
          .map(u => u.playId);
        continuationSOR103 = freshRebelPlayIds.length > 0
          ? { ...continuationSOR103, fromPlayIds: freshRebelPlayIds }
          : (continuationSOR103.continuation ?? null);
      }
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SOR_103",
        continuation: continuationSOR103,
      };
    }
    case "SOR_168": { // Precision Fire: push ForAttack Saboteur + Trooper bonus, then attack with chosen unit
      if (!targetPlayId) break;
      const unit168 = unitByPlayId(game.currentGameState, targetPlayId);
      if (!unit168) break;
      game.currentGameState.currentEffects.push({
        cardId: "SOR_168",
        duration: "ForAttack",
        affectedPlayer: unit168.controller,
        targetPlayId,
      });
      game.gameLog.push(`${CardTitle(pending.cardId)}: ${CardTitle(unit168.cardId)} gains Saboteur for this attack.`);
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SOR_168",
        continuation: pending.continuation,
      };
    }
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
      case "choose-option":     result = handleChooseOption(gs, log, dispatch, pending); break;
      case "choose-player":
      case "choose-trigger":
        // Reserved for future trigger-bag resolution
        result = { response: invalidResponse(`${dispatch.dispatchType} not yet implemented.`), pending, stateChanged: false };
        break;
      default:
        result = { response: invalidResponse(`Unknown dispatch type.`), pending: null, stateChanged: false };
    }

    // Snapshot the pre-dispatch state before top-level actions (play-card, initiate-attack,
    // use-ability, pass-action, claim-initiative). Resolution steps (choose-target, choose-option,
    // etc.) are part of the same logical action and must NOT add extra snapshots — doing so would
    // cause multi-step actions like Precision Fire to require multiple undos.
    const ACTION_STARTERS = [
      "play-card", "initiate-attack", "use-ability", "pass-action", "claim-initiative",
    ] as const;
    const shouldSnapshot =
      (ACTION_STARTERS as readonly string[]).includes(dispatch.dispatchType) &&
      !result.response.invalidAction;

    const updatedGame: Game = {
      id: game.id,
      currentGameState: gs,
      gameStateHistory: shouldSnapshot
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
