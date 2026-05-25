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
  CardIsUnique,
  CardTitle,
  CardTraits,
  CardType,
} from "@/server/engine/card-db/generated";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { CardIsLeader, GetGame, GetUnitsForPlayer, SetGame, TraitContains, UnitAttackedThisPhase } from "@/server/engine/core-functions";
import { Unit } from "@/server/engine/unit";

import type {
  ChooseOptionDispatchData,
  ChooseTargetDispatchData,
  DispatchResponse,
  GameDispatch,
  InitiateAttackDispatchData,
  NeedsOption,
  NeedsPlot,
  NeedsSpreadDamage,
  NeedsTarget,
  PlayCardDispatchData,
  PlaySmuggleDispatchData,
  RegroupResourceDispatchData,
  ResolutionRequest,
  UseAbilityDispatchData,
} from "@/lib/engine/message-types";
import { effectiveSmuggleCost } from "@/server/engine/card-playability";
import type { Game, GameState, PlayerState } from "@/lib/engine/game";
import type { CardInPlay, CurrentEffect, DiscardedCard, PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";
import type {
  AbilityOptionPending,
  AbilityTargetPending,
  AttackTargetPending,
  BountyShieldTargetPending,
  CaptureTargetPending,
  DefeatCopyPending,
  DiscardFromHandPending,
  DookuLeaderPlayPending,
  EclPlayPending,
  ReturnFromDiscardPending,
  GiveXpMultiplePending,
  EngineContext,
  ExploitOptionPending,
  ExploitTargetPending,
  L337ReplaceTargetPending,
  OnAttackOrderPending,
  OnAttackTriggerEntry,
  PendingResolution,
  PilotingOptionPending,
  PlotOrderPending,
  PlotWindowPending,
  ResolveAttackPending,
  SpreadDamagePending,
  TriggerOrderPending,
  UpgradeTargetPending,
} from "@/server/engine/pending-resolution";
import type { TriggerEntry } from "@/lib/engine/trigger-types";
import { collectBounties, drawCardForPlayer } from "@/server/engine/actions/bounty";
import { resolveWhenDefeated } from "@/server/engine/actions/when-defeated";
import { UpgradeEligibleTargets } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { resolveWhenPlayed } from "@/server/engine/actions/when-played";
import { executeRegroupDraw, tryRegroupResource, tryPassResource } from "@/server/engine/actions/regroup";
import { resolveWhenPlayedTrigger } from "@/server/engine/actions/when-played-trigger";
import { resolveOnAttackTrigger, applyDarksaberOnAttack } from "@/server/engine/actions/on-attack";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { ActionAbilities } from "@/server/engine/actions/action-ability";
import { ExploitAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/exploit";
import { PilotingCost } from "@/server/engine/card-db/keyword-dictionaries.ts/piloting";
import { PilotingEligibleVehicles } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { LeaderDeployPilotThreshold } from "@/server/engine/card-db/keyword-dictionaries.ts/leader-pilot-deploy";
import { HasPlot } from "@/server/engine/card-db/keyword-dictionaries.ts/plot";
import { resolveWhenDeployed } from "@/server/engine/actions/when-deployed";

// ---------------------------------------------------------------------------
// Helpers: hydration (plain objects → Unit class instances)
// ---------------------------------------------------------------------------

export function hydrateGame(game: Game): void {
  const hydrate = (units: UnitInterface[]) => units.map((u) => Unit.FromInterface(u));
  const g = game.currentGameState;
  g.player1.groundArena = hydrate(g.player1.groundArena);
  g.player1.spaceArena = hydrate(g.player1.spaceArena);
  g.player2.groundArena = hydrate(g.player2.groundArena);
  g.player2.spaceArena = hydrate(g.player2.spaceArena);
}

export function computeSentinelPlayIds(gs: GameState): string[] {
  const units = [
    ...gs.player1.groundArena, ...gs.player1.spaceArena,
    ...gs.player2.groundArena, ...gs.player2.spaceArena,
  ];
  return units
    .filter(u => { try { return HasSentinel(u.cardId, u.playId, u.controller); } catch { return false; } })
    .map(u => u.playId);
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

function sweepDeadUnits(gs: GameState, log: string[], continuation: PendingResolution | null): PendingResolution | null {
  let pending = continuation;
  for (const unit of allUnits(gs)) {
    if (Unit.FromInterface(unit).CurrentHP() <= 0) {
      const defeatPend = defeatUnit(gs, log, unit);
      if (defeatPend) pending = injectContinuation(defeatPend, pending);
    }
  }
  return pending;
}

function unitByPlayId(game: GameState, playId: string): Unit | null {
  return allUnits(game).find((u) => u.playId === playId) ?? null;
}

// ---------------------------------------------------------------------------
// Helpers: resources & cost
// ---------------------------------------------------------------------------

function aspectPenalty(game: GameState, player: PlayerId, cardId: string): number {
  const playerState = ps(game, player);

  // Darksaber: free aspect cost when a friendly Mandalorian non-Vehicle target exists
  if (cardId === "SHD_126") {
    const hasMandalorian = [...playerState.groundArena, ...playerState.spaceArena]
      .some(u => !TraitContains(u.cardId, "Vehicle") && TraitContains(u.cardId, "Mandalorian", player, u.playId));
    if (hasMandalorian) return 0;
  }

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

function pilotPlayCost(game: GameState, player: PlayerId, cardId: string): number {
  return PilotingCost(cardId) + aspectPenalty(game, player, cardId);
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
): { player: PlayerId; unit: Unit; zone: "groundArena" | "spaceArena" } | null {
  for (const player of [1, 2] as PlayerId[]) {
    const p = ps(game, player);
    for (const zone of ["groundArena", "spaceArena"] as const) {
      const idx = p[zone].findIndex((u) => u.playId === playId);
      if (idx !== -1) {
        const [unit] = p[zone].splice(idx, 1);
        return { player, unit: unit as Unit, zone };
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
 * Moves a unit to a new controller's arena, updating controller and removing from old arena.
 * Does not fire any triggers. Used for Take Control effects (Traitorous, Change of Heart).
 */
function transferControl(game: GameState, log: string[], unit: Unit, newController: PlayerId): void {
  const removed = removeFromArena(game, unit.playId);
  unit.controller = newController;
  const zone = removed?.zone ?? ((CardArena(unit.cardId) ?? "Ground") === "Ground" ? "groundArena" : "spaceArena");
  ps(game, newController)[zone].push(unit);
  log.push(`${CardTitle(unit.cardId)} is now controlled by Player ${newController}.`);
}

/**
 * Returns playIds of friendly Vehicle units that have zero pilot upgrades.
 * Used for L3-37's replacement effect — her card says "without a Pilot on it",
 * which means NO pilots at all (R2-D2 is a pilot via PilotingCost=0 and counts).
 */
function l337EligibleVehicles(game: GameState, player: PlayerId, l337PlayId: string): string[] {
  const p = ps(game, player);
  const friendly = [...p.groundArena, ...p.spaceArena] as Unit[];
  return friendly
    .filter(u => {
      if (u.playId === l337PlayId) return false;
      if (!TraitContains(u.cardId, "Vehicle")) return false;
      const pilotCount = u.upgrades.filter(
        upg => PilotingCost(upg.cardId) >= 0 ||
               (CardIsLeader(upg.cardId) && LeaderDeployPilotThreshold(upg.cardId) !== null)
      ).length;
      return pilotCount === 0;
    })
    .map(u => u.playId);
}

/**
 * Drains the trigger bag after an action resolves.
 * - 0 triggers: no-op
 * - 1 trigger: auto-resolve without player input
 * - 2+ triggers: presents a TriggerOrderPending so the player picks resolution order.
 */
function triggerLabel(t: TriggerEntry): string {
  const name = CardTitle(t.cardId) ?? t.cardId;
  switch (t.triggerType) {
    case "ambush":     return `${name} — Ambush`;
    case "when-played": return `${name} — When Played`;
    case "shielded":   return `${name} — Shielded`;
    default:           return `${name} — ${t.triggerType}`;
  }
}

function processSingleTrigger(trigger: TriggerEntry, game: GameState, log: string[]): PendingResolution | null {
  if (trigger.triggerType === "when-defeated") {
    const wdCtx = trigger.context as { defeatedUnit?: UnitInterface } | undefined;
    if (!wdCtx?.defeatedUnit) return null;
    const unit = Unit.FromInterface(wdCtx.defeatedUnit);
    return resolveWhenDefeated(unit, trigger.fromPlayer);
  }

  if (trigger.triggerType === "when-played") {
    const nextPending = resolveWhenPlayed(trigger.cardId, trigger.fromPlayer, trigger.playId);
    if (nextPending) return nextPending;
    resolveWhenPlayedTrigger(trigger, game, log);
    return null;
  }

  if (trigger.triggerType === "shielded" && trigger.playId) {
    const unit = unitByPlayId(game, trigger.playId);
    if (unit) {
      unit.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game), owner: trigger.fromPlayer, controller: trigger.fromPlayer });
      log.push(`Shielded: ${CardTitle(trigger.cardId)} enters play with a Shield token.`);
    }
    return null;
  }

  if (trigger.triggerType === "ambush" && trigger.playId) {
    const unit = unitByPlayId(game, trigger.playId);
    if (!unit) return null;
    const { unitPlayIds } = computeAttackTargets(game, unit as Unit);
    if (unitPlayIds.length === 0) return null; // no valid unit targets — fizzle
    return {
      type: "ability-option",
      cardId: trigger.cardId,
      helperText: `${CardTitle(trigger.cardId)} has Ambush — attack immediately?`,
      onYes: { type: "attack-target", attackerPlayId: trigger.playId, source: "ambush" },
      continuation: null,
    };
  }

  if (trigger.triggerType === "leader-reaction") {
    const leaderState = ps(game, trigger.fromPlayer).leader;
    if (leaderState.deployed || !leaderState.ready) return null;
    switch (trigger.cardId) {
      case "SHD_008": {
        const friendlyPlayIds = GetUnitsForPlayer(trigger.fromPlayer).map(u => u.playId);
        if (friendlyPlayIds.length === 0) return null;
        return {
          type: "ability-option",
          cardId: "SHD_008",
          helperText: "Exhaust Boba Fett — give a friendly unit +1/+0 for this phase?",
          onYes: {
            type: "ability-target",
            cardId: "SHD_008",
            player: trigger.fromPlayer,
            fromPlayIds: friendlyPlayIds,
            continuation: null,
          },
          continuation: null,
        } satisfies AbilityOptionPending;
      }
    }
    return null;
  }

  return null;
}

function drainTriggerBag(game: GameState, log: string[]): PendingResolution | null {
  // When-Defeated triggers from Exploit (CR 16d): drain in order, skip units with no WD effect.
  for (let i = 0; i < game.triggerBag.length; ) {
    const t = game.triggerBag[i];
    if (t.triggerType !== "when-defeated") { i++; continue; }
    game.triggerBag.splice(i, 1);
    const wdCtx = t.context as { defeatedUnit?: UnitInterface } | undefined;
    if (!wdCtx?.defeatedUnit) continue;
    const unit = Unit.FromInterface(wdCtx.defeatedUnit);
    const wdPending = resolveWhenDefeated(unit, t.fromPlayer);
    if (wdPending) return wdPending;
  }

  if (game.triggerBag.length === 0) return null;

  if (game.triggerBag.length >= 2) {
    const pending: TriggerOrderPending = {
      type: "trigger-order",
      triggers: game.triggerBag.map(t => ({
        label: triggerLabel(t),
        triggerType: t.triggerType,
        cardId: t.cardId,
        playId: t.playId,
        fromPlayer: t.fromPlayer,
      })),
    };
    return pending;
  }

  const [trigger] = game.triggerBag.splice(0, 1);
  return processSingleTrigger(trigger, game, log);
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
  bypassL337 = false,
): PendingResolution | null {
  // L3-37 replacement effect: intercept BEFORE removing from arena.
  if (!bypassL337 && unit.cardId === "JTL_049") {
    const eligible = l337EligibleVehicles(game, unit.controller, unit.playId);
    if (eligible.length > 0) {
      return {
        type: "l337-replace",
        unitPlayId: unit.playId,
        player: unit.controller,
        eligibleVehicles: eligible,
        continuation: null,
      };
    }
  }

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

  // Tokens are set aside on defeat, not placed in discard (CR 7.6.1).
  if (!unit.IsTokenUnit()) {
    pushToDiscard(game, removed.player, unit);
  }
  game.roundState.cardsLeftPlayThisPhase.push({
    fromPlayer: removed.player,
    cardId: unit.cardId,
    playId: unit.playId,
    reason: unit.IsTokenUnit() ? "token-defeated" : "defeated",
  });
  log.push(`${CardTitle(unit.cardId)} was defeated.`);

  // Rescue any units the defeated unit was guarding (CR 34.4).
  for (const captive of unit.captives ?? []) {
    const arena = (CardArena(captive.cardId) ?? "Ground") as "Ground" | "Space";
    const rescued = Unit.FromInterface({ ...captive, ready: false });
    if (arena === "Ground") ps(game, captive.owner).groundArena.push(rescued);
    else ps(game, captive.owner).spaceArena.push(rescued);
    game.roundState.cardsEnteredPlayThisPhase.push({
      fromPlayer: captive.owner,
      cardId: captive.cardId,
      playId: captive.playId,
      reason: "returned-to-play",
    });
    log.push(`${CardTitle(captive.cardId)} was rescued and returned to Player ${captive.owner}'s arena exhausted.`);
  }

  // When-Defeated triggers fire after bounty collection (CR 13c).
  const whenDefeated = resolveWhenDefeated(unit, removed.player);
  const collectingPlayer: PlayerId = removed.player === 1 ? 2 : 1;
  const chainedDefeated = collectBounties(unit, collectingPlayer, whenDefeated) ?? whenDefeated;

  // Luke Skywalker (JTL_094) as a pilot upgrade: when his vehicle is defeated, he may eject.
  const lukeUpgrade = unit.upgrades.find(upg => upg.cardId === "JTL_094");
  if (lukeUpgrade) {
    return {
      type: "when-defeated-choice",
      defeatedCardId: "JTL_094",
      defeatedPlayId: lukeUpgrade.playId,
      controlledBy: lukeUpgrade.controller as PlayerId,
      options: [`move_to_ground_exhausted=JTL_094,${lukeUpgrade.controller}`, "decline"],
      continuation: chainedDefeated,
    };
  }
  return chainedDefeated;
}

/**
 * Defeats a unit as part of Exploit cost payment (CR 16d).
 * Unlike defeatUnit, this adds a when-defeated trigger to the bag so WD fires
 * AFTER the card fully resolves — not as inline pending resolution.
 */
function defeatForExploit(game: GameState, log: string[], unit: Unit): void {
  const removed = removeFromArena(game, unit.playId);
  if (!removed) return;

  if (CardIsLeader(unit.cardId)) {
    const leader = ps(game, removed.player).leader;
    leader.deployed = false;
    leader.ready = false;
    leader.deployedPlayId = undefined;
    log.push(`${CardTitle(unit.cardId)} was defeated via Exploit and returned to the leader zone.`);
    return;
  }

  if (!unit.IsTokenUnit()) {
    pushToDiscard(game, removed.player, unit);
  }
  game.roundState.cardsLeftPlayThisPhase.push({
    fromPlayer: removed.player,
    cardId: unit.cardId,
    playId: unit.playId,
    reason: unit.IsTokenUnit() ? "token-defeated" : "defeated",
  });
  log.push(`${CardTitle(unit.cardId)} was defeated via Exploit.`);

  // Rescue captives (CR 34.4)
  for (const captive of unit.captives ?? []) {
    const arena = (CardArena(captive.cardId) ?? "Ground") as "Ground" | "Space";
    const rescued = Unit.FromInterface({ ...captive, ready: false });
    if (arena === "Ground") ps(game, captive.owner).groundArena.push(rescued);
    else ps(game, captive.owner).spaceArena.push(rescued);
    game.roundState.cardsEnteredPlayThisPhase.push({
      fromPlayer: captive.owner,
      cardId: captive.cardId,
      playId: captive.playId,
      reason: "returned-to-play",
    });
    log.push(`${CardTitle(captive.cardId)} was rescued from Exploit-defeated unit.`);
  }

  // Defer when-defeated trigger to bag (CR 16d: fires after Play a Card completes)
  game.triggerBag.push({
    triggerType: "when-defeated",
    cardId: unit.cardId,
    fromPlayer: removed.player,
    playId: unit.playId,
    context: { defeatedUnit: unit },
  });
}

// ---------------------------------------------------------------------------
// Helpers: attack target computation
// ---------------------------------------------------------------------------

function computeAttackTargets(
  game: GameState,
  attacker: Unit
): { unitPlayIds: string[]; includesBase: boolean } {
  const inGround =
    game.player1.groundArena.some(u => u.playId === attacker.playId) ||
    game.player2.groundArena.some(u => u.playId === attacker.playId);
  const arena = inGround ? "Ground" : "Space";
  const defenderPlayer = otherPlayer(attacker.controller);
  const p = ps(game, defenderPlayer);
  const opposing = (arena === "Ground" ? p.groundArena : p.spaceArena) as Unit[];

  // Hidden: exclude units played/deployed/created this phase. Rescued units (returned-to-play)
  // do not regain Hidden protection — only the original play/deploy/create triggers it.
  const enteredThisPhase = new Set(
    game.roundState.cardsEnteredPlayThisPhase
      .filter(e => e.reason !== "returned-to-play")
      .map(e => e.playId)
  );
  const visible = opposing.filter(u =>
    !HasHidden(u.cardId, u.playId, u.controller) ||
    !enteredThisPhase.has(u.playId) ||
    HasSentinel(u.cardId, u.playId, u.controller)
  );

  const sentinels = visible.filter((u) => {
    try {
      return HasSentinel(u.cardId, u.playId, u.controller);
    } catch {
      return false;
    }
  });

  if (sentinels.length > 0 && !HasSaboteur(attacker.cardId, attacker.playId, attacker.controller)) {
    return { unitPlayIds: sentinels.map((u) => u.playId), includesBase: false };
  }
  const entrenchedUnit = attacker.upgrades.some(u => u.cardId === "SOR_072");
  return { unitPlayIds: visible.map((u) => u.playId), includesBase: !entrenchedUnit };
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

  // Restore fires as an On Attack trigger before combat damage
  const restoreAmount = RestoreAmount(attacker.cardId, attacker.playId, attacker.controller);
  if (restoreAmount > 0) {
    const controllerBase = ps(game, attacker.controller).base;
    controllerBase.damage = Math.max(0, controllerBase.damage - restoreAmount);
    log.push(`Restore ${restoreAmount}: healed ${restoreAmount} damage from Player ${attacker.controller}'s base.`);
  }

  attacker.ready = false;
  game.roundState.unitsAttackedThisPhase.push({
    fromPlayer: attacker.controller,
    cardId: attacker.cardId,
    playId: attacker.playId,
  });
  const atkPower = attacker.CurrentPower(false, true);
  const attackerName = CardTitle(attacker.cardId);

  if (target.type === "base") {
    dealBaseDamage(game, target.player, atkPower);
    log.push(`${attackerName} attacked the base for ${atkPower} damage.`);
    const willSacrifice = game.currentEffects.some(
      e => e.cardId === "SOR_150_sacrifice" && e.targetPlayId === attacker.playId,
    );
    // Clear ForAttack effects scoped to this attacker after the attack resolves
    game.currentEffects = game.currentEffects.filter(
      (e) => !(e.duration === "ForAttack" && e.targetPlayId === attacker.playId),
    );
    const whenAttackEnds = resolveWhenAttackEnds(game, attacker, pending.continuation ?? null);
    if (willSacrifice) {
      log.push(`Heroic Sacrifice: ${attackerName} is defeated after dealing combat damage.`);
      const sacrificePend = defeatUnit(game, log, attacker);
      if (sacrificePend) return injectContinuation(sacrificePend, whenAttackEnds);
    }
    return whenAttackEnds;
  } else {
    const defender = unitByPlayId(game, target.playId);
    if (!defender) return null;

    const defPower = defender.CurrentPower();
    const defHpBefore = defender.CurrentHP();
    const defenderName = CardTitle(defender.cardId);

    // Saboteur: strip all Shield tokens from the defender before damage is dealt.
    // Skip if already applied via on-attack-order (player chose Saboteur first).
    if (!pending.saboteurApplied) {
      try {
        if (HasSaboteur(attacker.cardId, attacker.playId, attacker.controller)) {
          const before = defender.upgrades.length;
          defender.upgrades = defender.upgrades.filter(u => u.cardId !== "SOR_T02");
          const stripped = before - defender.upgrades.length;
          if (stripped > 0)
            log.push(`Saboteur: ${stripped} Shield token(s) defeated on ${defenderName}.`);
        }
      } catch { /* unit may not be in singleton during test setup */ }
    }

    // Shield token absorbs the first instance of damage to the defender.
    const shieldIdx = defender.upgrades.findIndex(u => u.cardId === "SOR_T02");
    if (shieldIdx !== -1) {
      defender.upgrades.splice(shieldIdx, 1);
      log.push(`${defenderName}'s Shield token was defeated, preventing ${atkPower} damage.`);
    } else {
      defender.damage += atkPower;
    }
    // Shield token absorbs the first instance of counter-damage to the attacker.
    const attackerShieldIdx = attacker.upgrades.findIndex(u => u.cardId === "SOR_T02");
    if (attackerShieldIdx !== -1) {
      attacker.upgrades.splice(attackerShieldIdx, 1);
      log.push(`${attackerName}'s Shield token was defeated, preventing ${defPower} counter-damage.`);
    } else {
      attacker.damage += defPower;
    }
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
    const willSacrificeUnit = game.currentEffects.some(
      e => e.cardId === "SOR_150_sacrifice" && e.targetPlayId === attacker.playId,
    );
    const atkDefeated = attacker.CurrentHP() <= 0 || willSacrificeUnit;

    // Clear ForAttack effects scoped to this attacker after the attack resolves
    game.currentEffects = game.currentEffects.filter(
      (e) => !(e.duration === "ForAttack" && e.targetPlayId === attacker.playId),
    );
    if (willSacrificeUnit && attacker.CurrentHP() > 0) {
      log.push(`Heroic Sacrifice: ${attackerName} is defeated after dealing combat damage.`);
    }

    // Resolve defeats (defender first per SWU rules)
    let nextPending: PendingResolution | null = null;
    if (defDefeated) nextPending = defeatUnit(game, log, defender) ?? nextPending;
    if (atkDefeated) nextPending = defeatUnit(game, log, attacker) ?? nextPending;
    if (nextPending) {
      // Append resolveWhenAttackEnds at the tail of the pending chain.
      // defeatUnit returns BountyPending | WhenDefeatedChoicePending, both have continuation.
      const whenAttackEnds = resolveWhenAttackEnds(game, attacker, pending.continuation ?? null);
      type WithContinuation = { continuation: PendingResolution | null | undefined };
      let tail: WithContinuation = nextPending as unknown as WithContinuation;
      while (tail.continuation != null) tail = tail.continuation as unknown as WithContinuation;
      tail.continuation = whenAttackEnds;
      return nextPending;
    }

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
  return { dispatchResponseId: randomUUID(), newGameState: game, sentinelPlayIds: computeSentinelPlayIds(game) };
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
      const { unitPlayIds, includesBase } = computeAttackTargets(game, attacker);
      const allowBase = includesBase && pending.source !== "ambush";
      return {
        type: "Target",
        fromPlayIds: unitPlayIds.length > 0 ? unitPlayIds : undefined,
        fromZones: allowBase ? ["Base"] : undefined,
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
    case "defeat-copy":
      return {
        type: "Target",
        fromPlayIds: pending.eligiblePlayIds,
      } satisfies NeedsTarget;
    case "capture-captor":
      return {
        type: "Target",
        fromPlayIds: pending.eligiblePlayIds,
      } satisfies NeedsTarget;
    case "capture-target":
      return {
        type: "Target",
        fromPlayIds: pending.eligiblePlayIds,
      } satisfies NeedsTarget;
    case "bounty":
      return {
        type: "Option",
        helperText: `Collect bounty (${CardTitle(pending.cardId)})?`,
        options: ["Yes", "No"],
      } satisfies NeedsOption;
    case "bounty-shield-target":
      return {
        type: "Target",
        fromPlayIds: pending.fromPlayIds,
      } satisfies NeedsTarget;
    case "resolve-attack":
      // Should never be shown to client — auto-resolves as continuation
      return { type: "Target" } satisfies NeedsTarget;
    case "exploit-option":
      return {
        type: "Option",
        helperText: `Use Exploit ${pending.exploitAmount} while playing ${CardTitle(pending.cardId)}?`,
        options: ["Yes", "No"],
      } satisfies NeedsOption;
    case "exploit-target":
      return {
        type: "Target",
        fromPlayIds: pending.fromPlayIds.length > 0 ? pending.fromPlayIds : undefined,
        maxTargets: pending.exploitAmount,
        needsMultiple: pending.exploitAmount > 1,
      } satisfies NeedsTarget;
    case "piloting-option":
      return {
        type: "Option",
        helperText: pending.source === "leader"
          ? `Deploy ${CardTitle(pending.cardId)} as a unit or as a pilot upgrade on a Vehicle?`
          : `Play ${CardTitle(pending.cardId)} as a unit or as a pilot upgrade on a Vehicle?`,
        options: pending.source === "leader" ? ["Deploy as Unit", "Deploy as Pilot"] : ["Play as Unit", "Play as Pilot"],
      } satisfies NeedsOption;
    case "plot-order":
      return {
        type: "Option",
        helperText: `Use Plot before or after When Deployed?`,
        options: ["Plot First", "When Deployed First"],
      } satisfies NeedsOption;
    case "plot-window":
      return {
        type: "Plot",
        fromPlayIds: pending.plotResourcePlayIds,
      } satisfies NeedsPlot;
    case "when-deployed":
      // Auto-resolves inline; should not normally be sent to client
      return { type: "Option", helperText: "Resolving When Deployed...", options: ["Continue"] } satisfies NeedsOption;
    case "pay-to-move-ground":
      return {
        type: "Option",
        helperText: `Pay ${pending.cost} resources to move ${CardTitle(pending.cardId)} to the ground arena and give 2 Experience tokens?`,
        options: ["Yes", "No"],
      } satisfies NeedsOption;
    case "trigger-order":
      return {
        type: "Option",
        helperText: "Choose which trigger to resolve first:",
        options: pending.triggers.map(t => t.label),
      } satisfies NeedsOption;
    case "l337-replace":
      return {
        type: "Option",
        helperText: "Attach L3-37 as an upgrade to a friendly Vehicle without a Pilot instead of being defeated?",
        options: ["Yes", "No"],
      } satisfies NeedsOption;
    case "l337-replace-target":
      return {
        type: "Target",
        fromPlayIds: pending.eligibleVehicles,
      } satisfies NeedsTarget;
    case "dooku-leader-play":
      return { type: "Target", fromZones: ["Hand"] } satisfies NeedsTarget;
    case "ecl-play":
      return { type: "Target", fromZones: ["Hand"] } satisfies NeedsTarget;
    case "return-from-discard":
      return {
        type: "Target",
        fromPlayIds: pending.eligiblePlayIds,
        fromZones: ["Discard"],
        maxTargets: pending.maxCount,
        needsMultiple: pending.maxCount > 1,
      } satisfies NeedsTarget;
    case "give-xp-multiple":
      return {
        type: "Target",
        fromPlayIds: pending.eligiblePlayIds,
        maxTargets: pending.maxCount,
        needsMultiple: pending.maxCount > 1,
      } satisfies NeedsTarget;
    case "spread-damage":
      return {
        type: "SpreadDamage",
        totalDamage: pending.totalDamage,
        optional: pending.optional,
        eligiblePlayIds: pending.eligiblePlayIds,
      } satisfies NeedsSpreadDamage;
    case "on-attack-order":
      return {
        type: "Option",
        helperText: "Choose which On Attack ability to resolve first:",
        options: pending.triggers.map(t => t.label),
      } satisfies NeedsOption;
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

/**
 * Finishes playing a card after cost has been paid and the card removed from hand.
 * Handles Unit placement, Upgrade targeting, Event resolution, and trigger draining.
 */
function completePlayCard(
  game: GameState,
  log: string[],
  cardId: string,
  player: PlayerId,
  opts?: {
    injectEffect?: Omit<CurrentEffect, "targetPlayId">;
  },
): HandlerResult {
  if (CardType(cardId) === "Unit") {
    const unit = addToArena(game, player, cardId, false);
    log.push(`${CardTitle(cardId) ?? cardId} entered the ${CardArena(cardId) ?? "ground"} arena.`);
    game.roundState.cardsPlayedThisPhase.push({ fromPlayer: player, cardId, playId: unit.playId });
    game.roundState.cardsEnteredPlayThisPhase.push({ fromPlayer: player, cardId, playId: unit.playId, reason: "played" });

    if (CardIsUnique(cardId)) {
      const controlled = [...ps(game, player).groundArena, ...ps(game, player).spaceArena] as Unit[];
      const copies = controlled.filter(u => u.cardId === cardId);
      if (copies.length > 1) {
        const defeatCopyPending: DefeatCopyPending = {
          type: "defeat-copy",
          eligiblePlayIds: copies.map(u => u.playId),
        };
        return { response: resolutionResponse(pendingToResolution(defeatCopyPending, game)), pending: defeatCopyPending, stateChanged: false };
      }
    }

    if (HasShielded(cardId, unit.playId, player)) {
      game.triggerBag.push({ triggerType: "shielded", cardId: unit.cardId, fromPlayer: player, playId: unit.playId });
    }
    if (opts?.injectEffect) {
      game.currentEffects.push({ ...opts.injectEffect, targetPlayId: unit.playId });
    }
    // Leader-reaction: Boba Fett — when the active player plays a keyword unit
    const leaderState = ps(game, player).leader;
    if (
      leaderState.cardId === "SHD_008" &&
      !leaderState.deployed &&
      leaderState.ready &&
      HasKeyword(cardId, "Any", unit.playId, player)
    ) {
      game.triggerBag.push({ triggerType: "leader-reaction", cardId: "SHD_008", fromPlayer: player });
    }

    const hasAmbush = HasAmbush(cardId, unit.playId, "Hand", player);
    if (hasAmbush) {
      game.triggerBag.push({ triggerType: "ambush", cardId: unit.cardId, fromPlayer: player, playId: unit.playId });
    }

    if (hasAmbush && CardHasWhenPlayed(unit.cardId)) {
      // Both Ambush and When Played — push both to bag so the player chooses ordering.
      game.triggerBag.push({ triggerType: "when-played", cardId: unit.cardId, fromPlayer: player, playId: unit.playId });
    } else if (!hasAmbush && CardHasWhenPlayed(unit.cardId)) {
      const whenPlayedPending = resolveWhenPlayed(unit.cardId, player, unit.playId);
      if (whenPlayedPending) {
        return { response: resolutionResponse(pendingToResolution(whenPlayedPending, game)), pending: whenPlayedPending, stateChanged: false };
      }
      // Auto-resolving WP (returns null) — push to bag so it fires via processSingleTrigger.
      game.triggerBag.push({ triggerType: "when-played", cardId: unit.cardId, fromPlayer: player, playId: unit.playId });
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

  const triggerPending = drainTriggerBag(game, log);
  updateDefeatedPlayers(game);
  if (triggerPending) {
    return { response: resolutionResponse(pendingToResolution(triggerPending, game)), pending: triggerPending, stateChanged: false };
  }
  return { response: stateResponse(game), pending: null, stateChanged: true };
}

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

  const fullCost = playCost(game, player, cardId);
  const exploitAmt = ExploitAmount(cardId, "hand", player, true); // report mode: peek without consuming
  const readyCount = ps(game, player).resources.filter(r => r.ready).length;
  const minCost = exploitAmt > 0 ? Math.max(0, fullCost - exploitAmt * 2) : fullCost;

  // --- Piloting branch (checked before the unit affordability guard) ---
  const pilotBase = PilotingCost(cardId);
  if (pilotBase >= 0) {
    const pilotCost = pilotPlayCost(game, player, cardId);
    const eligibleVehicles = PilotingEligibleVehicles(game, player);
    const canAffordUnit = readyCount >= fullCost;
    const canAffordPilot = readyCount >= pilotCost && eligibleVehicles.length > 0;

    if (canAffordPilot) {
      hand.splice(idx, 1);

      if (!canAffordUnit) {
        // Only piloting is affordable — skip prompt, go straight to vehicle target
        exhaustResources(game, player, pilotCost);
        log.push(`Player ${player} is playing ${CardTitle(cardId) ?? cardId} as a Pilot.`);
        const upgradePending: UpgradeTargetPending = {
          type: "upgrade-target",
          upgradeCardId: cardId,
          player,
          fromPlayIds: eligibleVehicles,
        };
        return { response: resolutionResponse(pendingToResolution(upgradePending, game)), pending: upgradePending, stateChanged: false };
      }

      // Both affordable — prompt for choice
      const pilotingOptionPending: PilotingOptionPending = {
        type: "piloting-option",
        cardId,
        playingPlayer: player,
        unitCost: fullCost,
        pilotingCost: pilotCost,
        source: "hand",
      };
      return { response: resolutionResponse(pendingToResolution(pilotingOptionPending, game)), pending: pilotingOptionPending, stateChanged: false };
    }
  }

  if (readyCount < minCost)
    return { response: invalidResponse(`Player ${player} cannot afford ${cardId}.`), pending: null, stateChanged: false };

  if (exploitAmt > 0) {
    hand.splice(idx, 1);
    log.push(`Player ${player} is playing ${CardTitle(cardId) ?? cardId} (Exploit ${exploitAmt} available).`);
    const exploitOptionPending: ExploitOptionPending = {
      type: "exploit-option",
      cardId,
      playingPlayer: player,
      exploitAmount: exploitAmt,
      fullCost,
    };
    return { response: resolutionResponse(pendingToResolution(exploitOptionPending, game)), pending: exploitOptionPending, stateChanged: false };
  }

  // No piloting, no exploit — pay full cost immediately
  exhaustResources(game, player, fullCost);
  hand.splice(idx, 1);
  log.push(`Player ${player} played ${CardTitle(cardId) ?? cardId}.`);
  return completePlayCard(game, log, cardId, player);
}

function handlePlaySmuggle(
  game: GameState,
  log: string[],
  dispatch: GameDispatch,
): HandlerResult {
  const { playId } = dispatch.dispatchData as PlaySmuggleDispatchData;
  const player = dispatch.fromPlayer;
  const p = ps(game, player);

  const resource = p.resources.find(r => r.playId === playId);
  if (!resource)
    return { response: invalidResponse(`Resource ${playId} not found for player ${player}.`), pending: null, stateChanged: false };

  const cost = effectiveSmuggleCost(game, player, resource);
  if (cost === null)
    return { response: invalidResponse(`Resource ${playId} (${resource.cardId}) cannot be Smuggled.`), pending: null, stateChanged: false };

  const readyCount = p.resources.filter(r => r.ready).length;
  if (readyCount < cost)
    return { response: invalidResponse(`Player ${player} cannot afford Smuggle cost of ${cost}.`), pending: null, stateChanged: false };

  const { cardId } = resource;
  const wasReady = resource.ready;

  const idx = p.resources.findIndex(r => r.playId === playId);
  p.resources.splice(idx, 1);

  exhaustResources(game, player, Math.max(0, wasReady ? cost - 1 : cost));

  if (p.deck.length > 0) {
    const topCard = p.deck.shift()!;
    p.resources.push({
      cardId: topCard.cardId,
      playId: String(game.nextPlayId++),
      owner: player,
      controller: player,
      ready: false,
      stolen: false,
    });
  }

  log.push(`Player ${player} played ${CardTitle(cardId)} via Smuggle.`);
  return completePlayCard(game, log, cardId, player);
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
  const attackerHasDarksaber = attacker.upgrades.some(u => u.cardId === "SHD_126");
  const attackerHasVambrace = attacker.upgrades.some(u => u.cardId === "SHD_177");
  const attackerHasHardpoint = attacker.upgrades.some(u => u.cardId === "SOR_121");
  if (["SOR_010", "SOR_014", "SHD_012", "TWI_186"].includes(attacker.cardId) || attackerHasDarksaber || attackerHasVambrace || attackerHasHardpoint) {
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

  // Base epic action
  const base = ps(game, player).base;
  if (base.cardId === data.cardId) {
    return handleBaseEpicAction(game, log, player);
  }

  return { response: invalidResponse("use-ability requires a leader cardId or a unit playId."), pending: null, stateChanged: false };
}

function handleBaseEpicAction(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const base = ps(game, player).base;
  if (base.epicActionUsed)
    return { response: invalidResponse("Base epic action already used this round."), pending: null, stateChanged: false };
  if (game.gamePhase !== "ActionPhase")
    return { response: invalidResponse("Base epic action can only be used during the action phase."), pending: null, stateChanged: false };

  switch (base.cardId) {
    case "SOR_022": return resolveEclEpicAction(game, log, player);
    default: return { response: invalidResponse("This base has no implemented epic action."), pending: null, stateChanged: false };
  }
}

function resolveEclEpicAction(game: GameState, log: string[], player: PlayerId): HandlerResult {
  ps(game, player).base.epicActionUsed = true;

  const readyCount = ps(game, player).resources.filter(r => r.ready).length;
  const eligible = ps(game, player).hand.filter(c =>
    CardType(c.cardId) === "Unit" &&
    (CardCost(c.cardId) ?? 0) <= 6 &&
    playCost(game, player, c.cardId) <= readyCount
  );

  if (eligible.length === 0) {
    log.push(`Player ${player} used Energy Conversion Lab — no eligible units to play.`);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  log.push(`Player ${player} used Energy Conversion Lab.`);
  const pending: EclPlayPending = { type: "ecl-play", player, continuation: null };
  return { response: resolutionResponse(pendingToResolution(pending, game)), pending, stateChanged: false };
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
    const bagPendingAtk = drainTriggerBag(game, log);
    if (bagPendingAtk) {
      return { response: resolutionResponse(pendingToResolution(bagPendingAtk, game)), pending: bagPendingAtk, stateChanged: false };
    }
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }
  if (pending.type === "plot-window") {
    const chosenPlayId = data.targetPlayIds?.[0];
    if (!chosenPlayId) {
      // Player passes on Plot
      if (pending.fireWhenDeployedAfter) resolveWhenDeployed(pending.leaderCardId, pending.player, log);
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }
    const playerState = ps(game, pending.player);
    const resourceIdx = playerState.resources.findIndex(r => r.playId === chosenPlayId);
    if (resourceIdx === -1)
      return { response: invalidResponse("Plot resource not found."), pending, stateChanged: false };
    const resource = playerState.resources[resourceIdx];
    if (!HasPlot(resource.cardId))
      return { response: invalidResponse("Chosen card is not a Plot card."), pending, stateChanged: false };
    if (!canAfford(game, pending.player, resource.cardId))
      return { response: invalidResponse("Not enough resources to play this Plot card."), pending, stateChanged: false };

    exhaustResources(game, pending.player, playCost(game, pending.player, resource.cardId));
    playerState.resources.splice(resourceIdx, 1);
    if (playerState.deck.length > 0) {
      const topCard = playerState.deck.shift()!;
      playerState.resources.push({ cardId: topCard.cardId, playId: nextPlayId(game), owner: pending.player, controller: pending.player, ready: false, stolen: false });
    }
    log.push(`Player ${pending.player} played ${CardTitle(resource.cardId)} from resources via Plot.`);
    const newUnit = addToArena(game, pending.player, resource.cardId, false);

    // CR 19d: only cards already in resources when the leader deployed may be played.
    // The deck replacement card cannot be played during the same deploy action.
    // Filter the original plotResourcePlayIds list (never re-scan all resources).
    const remainingPlotPlayIds = pending.plotResourcePlayIds.filter(pid =>
      playerState.resources.some(r => r.playId === pid && canAfford(game, pending.player, r.cardId)));
    let nextCont: PendingResolution | null;
    if (remainingPlotPlayIds.length > 0) {
      nextCont = {
        type: "plot-window",
        player: pending.player,
        leaderCardId: pending.leaderCardId,
        plotResourcePlayIds: remainingPlotPlayIds,
        fireWhenDeployedAfter: pending.fireWhenDeployedAfter,
      } satisfies PlotWindowPending;
    } else if (pending.fireWhenDeployedAfter) {
      nextCont = { type: "when-deployed", leaderCardId: pending.leaderCardId, player: pending.player };
    } else {
      nextCont = null;
    }

    const whenPlayedPending = resolveWhenPlayed(resource.cardId, pending.player, newUnit.playId);
    if (whenPlayedPending) {
      const chained = injectContinuation(whenPlayedPending, nextCont);
      return { response: resolutionResponse(pendingToResolution(chained, game)), pending: chained, stateChanged: true };
    }
    // No whenPlayed: advance to next continuation directly
    if (nextCont?.type === "plot-window") {
      return { response: resolutionResponse(pendingToResolution(nextCont, game)), pending: nextCont, stateChanged: true };
    }
    if (nextCont?.type === "when-deployed") {
      resolveWhenDeployed(nextCont.leaderCardId, nextCont.player, log);
    }
    updateDefeatedPlayers(game);
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
    if (rawPending?.type === "when-deployed") {
      resolveWhenDeployed(rawPending.leaderCardId, rawPending.player, log);
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }
    if (rawPending?.type === "plot-window") {
      return { response: resolutionResponse(pendingToResolution(rawPending, game)), pending: rawPending, stateChanged: true };
    }
    if (rawPending) {
      return { response: resolutionResponse(pendingToResolution(rawPending, game)), pending: rawPending, stateChanged: false };
    }
    // Drain any triggers that were waiting while this ability resolved (e.g. Ambush
    // still in the bag after a trigger-order put leader-reaction first).
    const bagAfterAbility = drainTriggerBag(game, log);
    if (bagAfterAbility) {
      if (bagAfterAbility.type === "attack-target" && bagAfterAbility.source === "ambush") {
        const ambushUnit = unitByPlayId(game, bagAfterAbility.attackerPlayId);
        if (ambushUnit) ambushUnit.ready = true;
      }
      return { response: resolutionResponse(pendingToResolution(bagAfterAbility, game)), pending: bagAfterAbility, stateChanged: false };
    }
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "return-from-discard") {
    const chosen = data.targetPlayIds ?? [];
    const invalid = chosen.find(id => !pending.eligiblePlayIds.includes(id));
    if (invalid)
      return { response: invalidResponse(`Card ${invalid} is not eligible for return from discard.`), pending, stateChanged: false };
    const playerState = ps(game, pending.player);
    const returned: string[] = [];
    for (const playId of chosen.slice(0, pending.maxCount)) {
      const idx = playerState.discard.findIndex(d => d.playId === playId);
      if (idx !== -1) {
        const card = playerState.discard.splice(idx, 1)[0];
        playerState.hand.push({ cardId: card.cardId });
        returned.push(CardTitle(card.cardId) ?? card.cardId);
      }
    }
    if (returned.length > 0)
      log.push(`${CardTitle(pending.cardId)}: returned ${returned.join(", ")} to hand.`);
    const next = pending.continuation;
    if (next)
      return { response: resolutionResponse(pendingToResolution(next, game)), pending: next, stateChanged: false };
    const bagAfterReturn = drainTriggerBag(game, log);
    if (bagAfterReturn)
      return { response: resolutionResponse(pendingToResolution(bagAfterReturn, game)), pending: bagAfterReturn, stateChanged: false };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "give-xp-multiple") {
    const chosen = (data.targetPlayIds ?? []).slice(0, pending.maxCount);
    const invalid = chosen.find(id => !pending.eligiblePlayIds.includes(id));
    if (invalid)
      return { response: invalidResponse(`Unit ${invalid} is not eligible for Experience token.`), pending, stateChanged: false };
    const gifted: string[] = [];
    for (const playId of chosen) {
      const target = unitByPlayId(game, playId);
      if (target) {
        target.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: target.owner, controller: target.controller });
        gifted.push(CardTitle(target.cardId) ?? target.cardId);
      }
    }
    if (gifted.length > 0)
      log.push(`${CardTitle(pending.cardId)}: gave Experience to ${gifted.join(", ")}.`);
    const next = pending.continuation;
    if (next)
      return { response: resolutionResponse(pendingToResolution(next, game)), pending: next, stateChanged: false };
    const bagAfterXp = drainTriggerBag(game, log);
    if (bagAfterXp)
      return { response: resolutionResponse(pendingToResolution(bagAfterXp, game)), pending: bagAfterXp, stateChanged: false };
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

  if (pending.type === "defeat-copy") {
    const chosen = data.targetPlayIds?.[0];
    if (!chosen)
      return { response: invalidResponse("choose-target must include targetPlayIds to resolve uniqueness."), pending, stateChanged: false };
    if (!pending.eligiblePlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid uniqueness choice.`), pending, stateChanged: false };
    const unit = unitByPlayId(game, chosen);
    if (!unit)
      return { response: invalidResponse("Chosen unit not found."), pending, stateChanged: false };
    defeatUnit(game, log, unit);
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "capture-captor") {
    const chosen = data.targetPlayIds?.[0];
    if (!chosen)
      return { response: invalidResponse("Choose a friendly unit to capture with."), pending, stateChanged: false };
    if (!pending.eligiblePlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid captor.`), pending, stateChanged: false };
    const captor = unitByPlayId(game, chosen);
    if (!captor)
      return { response: invalidResponse("Captor unit not found."), pending, stateChanged: false };
    const captorArena = (CardArena(captor.cardId) ?? "Ground") as "Ground" | "Space";
    const enemyPlayer = otherPlayer(pending.fromPlayer);
    const enemyArena = captorArena === "Ground"
      ? (ps(game, enemyPlayer).groundArena as Unit[])
      : (ps(game, enemyPlayer).spaceArena as Unit[]);
    const eligible = enemyArena.filter(u => !CardIsLeader(u.cardId));
    if (eligible.length === 0)
      return { response: invalidResponse("No valid capture targets in that arena."), pending, stateChanged: false };
    const captureTargetPending: CaptureTargetPending = {
      type: "capture-target",
      cardId: pending.cardId,
      fromPlayer: pending.fromPlayer,
      captorPlayId: chosen,
      eligiblePlayIds: eligible.map(u => u.playId),
    };
    return { response: resolutionResponse(pendingToResolution(captureTargetPending, game)), pending: captureTargetPending, stateChanged: false };
  }

  if (pending.type === "capture-target") {
    const chosen = data.targetPlayIds?.[0];
    if (!chosen)
      return { response: invalidResponse("Choose an enemy unit to capture."), pending, stateChanged: false };
    if (!pending.eligiblePlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid capture target.`), pending, stateChanged: false };
    const target = unitByPlayId(game, chosen);
    const captor = unitByPlayId(game, pending.captorPlayId);
    if (!target || !captor)
      return { response: invalidResponse("Captor or target unit not found."), pending, stateChanged: false };

    // Remove target from arena; this does NOT go through defeatUnit (no When Defeated triggers).
    removeFromArena(game, target.playId);

    // Token units are defeated on capture instead of placed under the captor (CR 34.5).
    if (target.IsTokenUnit()) {
      log.push(`${CardTitle(target.cardId)} was captured and set aside (token).`);
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    } else {
      // Compute bounties BEFORE clearing upgrades — upgrades carry bounty grants.
      const captureCollector: PlayerId = target.controller === 1 ? 2 : 1;
      const bountyPending = collectBounties(target, captureCollector, null);

      // Remove all damage, defeat all upgrades, place facedown under captor.
      target.damage = 0;
      target.upgrades = [];
      captor.captives.push(target);
      log.push(`${CardTitle(captor.cardId)} captured ${CardTitle(target.cardId)}.`);
      // Remove from phase tracking so rescue later doesn't carry "played this phase" status.
      game.roundState.cardsPlayedThisPhase = game.roundState.cardsPlayedThisPhase.filter(e => e.playId !== target.playId);
      game.roundState.cardsEnteredPlayThisPhase = game.roundState.cardsEnteredPlayThisPhase.filter(e => e.playId !== target.playId);

      updateDefeatedPlayers(game);
      if (bountyPending) {
        return { response: resolutionResponse(pendingToResolution(bountyPending, game)), pending: bountyPending, stateChanged: true };
      }
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }
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
    // If a leader deployed as a pilot, record the upgrade's playId as deployedPlayId
    if (CardIsLeader(pending.upgradeCardId)) {
      ps(game, pending.player).leader.deployedPlayId = upgradeInPlay.playId;
    }
    const isPilot = PilotingCost(pending.upgradeCardId) >= 0;
    if (isPilot) {
      log.push(`${CardTitle(pending.upgradeCardId)} is piloting ${CardTitle(targetUnit.cardId)}.`);
    } else {
      log.push(`${CardTitle(pending.upgradeCardId)} attached to ${CardTitle(targetUnit.cardId)}.`);
    }

    // Traitorous (SOR_122): take control of the attached unit when it costs 3 or less.
    if (pending.upgradeCardId === "SOR_122"
        && !CardIsLeader(targetUnit.cardId)
        && CardCost(targetUnit.cardId) <= 3
        && targetUnit.controller !== pending.player) {
      transferControl(game, log, targetUnit, pending.player);
    }

    // SHD_073 Mandalorian Armor: When Played — if attached unit is Mandalorian, give Shield.
    if (pending.upgradeCardId === "SHD_073") {
      if (TraitContains(targetUnit.cardId, "Mandalorian", pending.player, targetUnit.playId)) {
        targetUnit.upgrades.push({
          cardId: "SOR_T02",
          playId: nextPlayId(game),
          owner: pending.player,
          controller: pending.player,
        });
        log.push(`Mandalorian Armor: Shield token given to ${CardTitle(targetUnit.cardId)}.`);
      }
    }

    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "bounty-shield-target") {
    const chosen = data.targetPlayIds?.[0];
    if (!chosen)
      return { response: invalidResponse("Choose a unit to give the Shield token to."), pending, stateChanged: false };
    if (!pending.fromPlayIds.includes(chosen))
      return { response: invalidResponse("Chosen unit is not a valid shield target."), pending, stateChanged: false };
    const targetUnit = unitByPlayId(game, chosen);
    if (!targetUnit)
      return { response: invalidResponse("Target unit not found."), pending, stateChanged: false };

    targetUnit.upgrades.push({
      cardId: "SOR_T02",
      playId: nextPlayId(game),
      owner: pending.collectingPlayer,
      controller: pending.collectingPlayer,
    });
    log.push(`Bounty collected: Shield token placed on ${CardTitle(targetUnit.cardId)}.`);

    updateDefeatedPlayers(game);
    const next = pending.continuation;
    if (next) return { response: resolutionResponse(pendingToResolution(next, game)), pending: next, stateChanged: true };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "exploit-target") {
    const chosen = data.targetPlayIds ?? [];
    // Player may choose fewer than exploitAmount units (including 0)
    if (chosen.length > pending.exploitAmount)
      return { response: invalidResponse(`You may defeat at most ${pending.exploitAmount} unit(s) with Exploit.`), pending, stateChanged: false };
    for (const playId of chosen) {
      if (!pending.fromPlayIds.includes(playId))
        return { response: invalidResponse(`Unit ${playId} is not a valid Exploit target.`), pending, stateChanged: false };
    }

    // Defeat chosen units via Exploit (CR 16d: WD triggers fire after card enters play)
    for (const playId of chosen) {
      const unit = unitByPlayId(game, playId);
      if (unit) defeatForExploit(game, log, unit);
    }

    // Cost = fullCost − 2 per defeated unit, minimum 0
    const reducedCost = Math.max(0, pending.fullCost - chosen.length * 2);
    const readyCount = ps(game, pending.playingPlayer).resources.filter(r => r.ready).length;
    if (readyCount < reducedCost) {
      // Shouldn't normally happen (we validated before offering Exploit), but guard anyway
      return { response: invalidResponse(`Not enough resources after Exploit reduction.`), pending, stateChanged: false };
    }

    // Consume the Exploit current-effect by calling ExploitAmount in consume mode
    ExploitAmount(pending.cardId, "hand", pending.playingPlayer, false);

    exhaustResources(game, pending.playingPlayer, reducedCost);
    log.push(`Player ${pending.playingPlayer} played ${CardTitle(pending.cardId)} using Exploit (defeated ${chosen.length} unit(s), cost reduced by ${chosen.length * 2}).`);
    return completePlayCard(game, log, pending.cardId, pending.playingPlayer);
  }

  if (pending.type === "l337-replace-target") {
    const chosen = data.targetPlayIds?.[0];
    if (!chosen)
      return { response: invalidResponse("Choose a Vehicle to attach L3-37 to."), pending, stateChanged: false };
    if (!pending.eligibleVehicles.includes(chosen))
      return { response: invalidResponse(`Vehicle ${chosen} is not a valid target for L3-37.`), pending, stateChanged: false };

    const l3 = unitByPlayId(game, pending.unitPlayId);
    const vehicle = unitByPlayId(game, chosen);
    if (!l3 || !vehicle)
      return { response: invalidResponse("L3-37 or target vehicle not found."), pending, stateChanged: false };

    // Remove L3-37 from arena without going to discard (she's becoming an upgrade).
    removeFromArena(game, l3.playId);
    // Defeat all upgrades on her per card text (just remove them).
    for (const upg of l3.upgrades) {
      log.push(`${CardTitle(upg.cardId)} on L3-37 was defeated.`);
    }
    // Rescue captives if any.
    for (const captive of l3.captives ?? []) {
      const arena = (CardArena(captive.cardId) ?? "Ground") as "Ground" | "Space";
      const rescued = Unit.FromInterface({ ...captive, ready: false });
      if (arena === "Ground") ps(game, captive.owner).groundArena.push(rescued);
      else ps(game, captive.owner).spaceArena.push(rescued);
      log.push(`${CardTitle(captive.cardId)} was rescued from L3-37.`);
    }
    // Attach L3-37 as a pilot upgrade to the chosen vehicle (all damage removed, no upgrades).
    vehicle.upgrades.push({
      cardId: "JTL_049",
      playId: nextPlayId(game),
      owner: pending.player,
      controller: pending.player,
    });
    log.push(`L3-37 attached as a pilot upgrade to ${CardTitle(vehicle.cardId)}.`);

    const nextPendingL3 = pending.continuation ?? null;
    updateDefeatedPlayers(game);
    if (nextPendingL3) return { response: resolutionResponse(pendingToResolution(nextPendingL3, game)), pending: nextPendingL3, stateChanged: true };
    const bagL3 = drainTriggerBag(game, log);
    if (bagL3) return { response: resolutionResponse(pendingToResolution(bagL3, game)), pending: bagL3, stateChanged: true };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "ecl-play") {
    const idx = data.targetIndices?.[0];
    if (idx == null)
      return { response: invalidResponse("Choose a card from hand to play."), pending, stateChanged: false };
    const hand = ps(game, pending.player).hand;
    if (idx < 0 || idx >= hand.length)
      return { response: invalidResponse("Invalid hand index."), pending, stateChanged: false };
    const cardId = hand[idx].cardId;
    if (CardType(cardId) !== "Unit")
      return { response: invalidResponse("ECL: chosen card is not a Unit."), pending, stateChanged: false };
    if ((CardCost(cardId) ?? 0) > 6)
      return { response: invalidResponse("ECL: chosen unit costs more than 6."), pending, stateChanged: false };
    const cost = playCost(game, pending.player, cardId);
    const readyCount = ps(game, pending.player).resources.filter(r => r.ready).length;
    if (readyCount < cost)
      return { response: invalidResponse("ECL: not enough resources to play this unit."), pending, stateChanged: false };

    exhaustResources(game, pending.player, cost);
    hand.splice(idx, 1);
    log.push(`Player ${pending.player} played ${CardTitle(cardId) ?? cardId} via Energy Conversion Lab.`);
    return completePlayCard(game, log, cardId, pending.player, {
      injectEffect: { cardId: "SOR_022", duration: "Phase", affectedPlayer: pending.player },
    });
  }

  if (pending.type === "dooku-leader-play") {
    const idx = data.targetIndices?.[0];
    if (idx == null)
      return { response: invalidResponse("Choose a Separatist card from hand to play."), pending, stateChanged: false };
    const hand = ps(game, pending.player).hand;
    if (idx < 0 || idx >= hand.length)
      return { response: invalidResponse("Invalid hand index."), pending, stateChanged: false };
    const cardId = hand[idx].cardId;
    if (!CardTraits(cardId).includes("Separatist"))
      return { response: invalidResponse("Dooku: chosen card is not a Separatist card."), pending, stateChanged: false };

    const fullCost = playCost(game, pending.player, cardId);
    // Card's own native exploit + Dooku's +1 bonus (bypass currentEffects so nothing is consumed here)
    const cardExploit = ExploitAmount(cardId, undefined, undefined, true);
    const totalExploit = cardExploit + 1;
    const readyCount = ps(game, pending.player).resources.filter(r => r.ready).length;
    const minCost = Math.max(0, fullCost - totalExploit * 2);

    if (readyCount < minCost)
      return { response: invalidResponse("Not enough resources to play that card."), pending, stateChanged: false };

    hand.splice(idx, 1);
    log.push(`Player ${pending.player} played ${CardTitle(cardId)} via Count Dooku's action (Exploit ${totalExploit} available).`);

    const exploitPending: ExploitOptionPending = {
      type: "exploit-option",
      cardId,
      playingPlayer: pending.player,
      exploitAmount: totalExploit,
      fullCost,
    };
    return { response: resolutionResponse(pendingToResolution(exploitPending, game)), pending: exploitPending, stateChanged: false };
  }

  if (pending.type === "spread-damage") {
    const assignments = (data.spreadDamageAssignments ?? []).filter(
      a => pending.eligiblePlayIds.includes(a.playId) && a.damage > 0,
    );
    const total = assignments.reduce((sum, a) => sum + a.damage, 0);

    if (pending.optional) {
      if (total !== 0 && total !== pending.totalDamage) {
        return { response: invalidResponse(`Spread damage must be 0 or all ${pending.totalDamage}. No partial damage.`), pending, stateChanged: false };
      }
    } else {
      if (total !== pending.totalDamage) {
        return { response: invalidResponse(`Must assign exactly ${pending.totalDamage} damage.`), pending, stateChanged: false };
      }
    }

    for (const assignment of assignments) {
      const unit = unitByPlayId(game, assignment.playId);
      if (!unit) continue;
      const shieldIdx = unit.upgrades.findIndex(u => u.cardId === "SOR_T02");
      if (shieldIdx !== -1) {
        unit.upgrades.splice(shieldIdx, 1);
        log.push(`${CardTitle(unit.cardId)}'s Shield token was defeated, preventing ${assignment.damage} damage.`);
      } else {
        unit.damage += assignment.damage;
      }
    }

    if (total > 0) {
      log.push(`${CardTitle(pending.cardId)}: damage spread among targets.`);
    }
    updateDefeatedPlayers(game);
    const afterSweep = sweepDeadUnits(game, log, pending.continuation ?? null);
    if (afterSweep) {
      if (afterSweep.type === "resolve-attack") return handleResolveAttack(game, log, afterSweep);
      return { response: resolutionResponse(pendingToResolution(afterSweep, game)), pending: afterSweep, stateChanged: true };
    }
    const bag = drainTriggerBag(game, log);
    if (bag) return { response: resolutionResponse(pendingToResolution(bag, game)), pending: bag, stateChanged: true };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  return { response: invalidResponse(`choose-target is not valid while pending: ${pending.type}.`), pending, stateChanged: false };
}

/**
 * Process a single on-attack trigger directly (used when only 1 trigger remains after ordering).
 * Auto-resolving triggers (saboteur, darksaber) return a ResolveAttackPending.
 * Input-requiring triggers (vambrace, native) return their prompt pending.
 */
function processSingleOnAttackTrigger(
  trigger: OnAttackTriggerEntry,
  attacker: Unit,
  cont: ResolveAttackPending,
  game: GameState,
  log: string[],
): PendingResolution | null {
  switch (trigger.id) {
    case "saboteur": {
      if (cont.target.type === "unit") {
        const def = unitByPlayId(game, cont.target.playId);
        if (def) {
          const before = def.upgrades.length;
          def.upgrades = def.upgrades.filter(u => u.cardId !== "SOR_T02");
          const stripped = before - def.upgrades.length;
          if (stripped > 0)
            log.push(`Saboteur: ${stripped} Shield token(s) defeated on ${CardTitle(def.cardId)}.`);
        }
      }
      return { ...cont, saboteurApplied: true };
    }
    case "darksaber": {
      applyDarksaberOnAttack(attacker);
      return cont;
    }
    case "vambrace": {
      const opponent = attacker.controller === 1 ? 2 : 1;
      const enemyGround = (opponent === 1 ? game.player1.groundArena : game.player2.groundArena).map(u => u.playId);
      if (enemyGround.length === 0) return cont;
      const spreadPending: SpreadDamagePending = {
        type: "spread-damage",
        cardId: "SHD_177",
        player: attacker.controller,
        totalDamage: 3,
        optional: true,
        eligiblePlayIds: enemyGround,
        continuation: cont,
      };
      return {
        type: "ability-option",
        cardId: "SHD_177",
        helperText: "Deal 3 damage divided among enemy ground units?",
        onYes: spreadPending,
        continuation: cont,
      };
    }
    case "hardpoint": {
      if (cont.target.type !== "unit") return cont;
      const defenderPlayId121 = cont.target.playId;
      const inGround121 = [...game.player1.groundArena, ...game.player2.groundArena].some(u => u.playId === defenderPlayId121);
      const arenaUnits121 = inGround121
        ? [...game.player1.groundArena, ...game.player2.groundArena]
        : [...game.player1.spaceArena, ...game.player2.spaceArena];
      if (arenaUnits121.length === 0) return cont;
      return {
        type: "ability-option",
        cardId: "SOR_121",
        helperText: "Deal 2 damage to a unit in the defender's arena?",
        onYes: {
          type: "ability-target",
          cardId: "SOR_121",
          fromPlayIds: arenaUnits121.map(u => u.playId),
          continuation: cont,
        },
        continuation: cont,
      };
    }
    case "native":
      return resolveOnAttackTrigger(attacker, cont, { skipOrderingPrompt: true });
  }
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
        // Ambush: ready the unit before it attacks so it can exhaust normally during combat.
        if (nextPending.type === "attack-target" && nextPending.source === "ambush") {
          const ambushUnit = unitByPlayId(game, nextPending.attackerPlayId);
          if (ambushUnit) ambushUnit.ready = true;
        }
        return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
      }
      // onYes resolved with no further pending — drain any remaining triggers before returning.
      const bagPendingYes = drainTriggerBag(game, log);
      if (bagPendingYes) {
        return { response: resolutionResponse(pendingToResolution(bagPendingYes, game)), pending: bagPendingYes, stateChanged: false };
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
    // No continuation — drain any remaining triggers before returning.
    const bagPendingNo = drainTriggerBag(game, log);
    if (bagPendingNo) {
      return { response: resolutionResponse(pendingToResolution(bagPendingNo, game)), pending: bagPendingNo, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending?.type === "pay-to-move-ground") {
    if (option === "Yes") {
      exhaustResources(game, pending.player, pending.cost);
      const unit = unitByPlayId(game, pending.sourcePlayId);
      if (unit) {
        const pState = ps(game, unit.controller);
        const spaceIdx = pState.spaceArena.findIndex(u => u.playId === unit.playId);
        if (spaceIdx !== -1) {
          pState.spaceArena.splice(spaceIdx, 1);
          pState.groundArena.push(unit);
        }
        unit.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: unit.owner, controller: unit.controller });
        unit.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: unit.owner, controller: unit.controller });
        log.push(`${CardTitle(unit.cardId)} moved to the ground arena and gained 2 Experience tokens.`);
      }
    }
    const nextPending = pending.continuation;
    if (nextPending) {
      if (nextPending.type === "attack-target" && nextPending.source === "ambush") {
        const ambushUnit = unitByPlayId(game, nextPending.attackerPlayId);
        if (ambushUnit) ambushUnit.ready = true;
      }
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    // Drain any remaining triggers (e.g. ambush still in bag after When Played resolved).
    const bagPendingMove = drainTriggerBag(game, log);
    if (bagPendingMove) {
      return { response: resolutionResponse(pendingToResolution(bagPendingMove, game)), pending: bagPendingMove, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending?.type === "l337-replace") {
    if (option === "Yes") {
      const replacePending: L337ReplaceTargetPending = {
        type: "l337-replace-target",
        unitPlayId: pending.unitPlayId,
        player: pending.player,
        eligibleVehicles: pending.eligibleVehicles,
        continuation: pending.continuation,
      };
      return { response: resolutionResponse(pendingToResolution(replacePending, game)), pending: replacePending, stateChanged: false };
    }
    // "No" — defeat L3-37 normally (bypass the replacement check to avoid re-triggering).
    const l337Unit = unitByPlayId(game, pending.unitPlayId);
    let nextPending: PendingResolution | null = pending.continuation ?? null;
    if (l337Unit) {
      const defeatPending = defeatUnit(game, log, l337Unit, true);
      if (defeatPending) {
        type WithCont = { continuation?: PendingResolution | null };
        let tail: WithCont = defeatPending as unknown as WithCont;
        while (tail.continuation != null) tail = tail.continuation as unknown as WithCont;
        tail.continuation = nextPending;
        nextPending = defeatPending;
      }
    }
    updateDefeatedPlayers(game);
    if (nextPending) return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    const bagL337No = drainTriggerBag(game, log);
    if (bagL337No) return { response: resolutionResponse(pendingToResolution(bagL337No, game)), pending: bagL337No, stateChanged: false };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending?.type === "on-attack-order") {
    const attacker = unitByPlayId(game, pending.attackerPlayId) as Unit | null;
    if (!attacker) {
      return handleResolveAttack(game, log, pending.continuation);
    }

    const chosenIdx = pending.triggers.findIndex(t => t.label === option);
    if (chosenIdx === -1) {
      return { response: invalidResponse(`Unknown on-attack trigger: ${option}`), pending, stateChanged: false };
    }
    const chosen = pending.triggers[chosenIdx];
    const remaining = pending.triggers.filter((_, i) => i !== chosenIdx);

    // Build the pending for the remaining triggers (with the given continuation for combat).
    // If 2+ remain: show ordering prompt again.
    // If 1 remains: process it directly (auto-triggers resolve immediately, input-triggers return their pending).
    // If 0 remain: the continuation (ResolveAttackPending) flows to combat.
    const buildRemaining = (cont: ResolveAttackPending): PendingResolution | null => {
      if (remaining.length === 0) return cont;
      if (remaining.length >= 2) {
        return {
          type: "on-attack-order",
          attackerPlayId: attacker.playId,
          player: attacker.controller,
          triggers: remaining,
          continuation: cont,
        } satisfies OnAttackOrderPending;
      }
      // 1 remaining — resolve it directly
      return processSingleOnAttackTrigger(remaining[0], attacker, cont, game, log);
    };

    // Helper for routing the result back to the caller
    const returnPending = (next: PendingResolution | null, fallbackCont: ResolveAttackPending): HandlerResult => {
      if (!next || next.type === "resolve-attack") return handleResolveAttack(game, log, (next ?? fallbackCont) as ResolveAttackPending);
      return { response: resolutionResponse(pendingToResolution(next, game)), pending: next, stateChanged: false };
    };

    switch (chosen.id) {
      case "saboteur": {
        // Strip defender's shields now
        if (pending.continuation.target.type === "unit") {
          const defender = unitByPlayId(game, pending.continuation.target.playId);
          if (defender) {
            const before = defender.upgrades.length;
            defender.upgrades = defender.upgrades.filter(u => u.cardId !== "SOR_T02");
            const stripped = before - defender.upgrades.length;
            if (stripped > 0)
              log.push(`Saboteur: ${stripped} Shield token(s) defeated on ${CardTitle(defender.cardId)}.`);
          }
        }
        const contSab: ResolveAttackPending = { ...pending.continuation, saboteurApplied: true };
        return returnPending(buildRemaining(contSab), contSab);
      }
      case "darksaber": {
        // Auto: give XP to other friendly Mandalorian units
        applyDarksaberOnAttack(attacker);
        return returnPending(buildRemaining(pending.continuation), pending.continuation);
      }
      case "vambrace": {
        // Build VF option; wrap its continuation with remaining triggers
        const afterVF = buildRemaining(pending.continuation);
        const vfCont: ResolveAttackPending | PendingResolution = afterVF ?? pending.continuation;
        const opponent = attacker.controller === 1 ? 2 : 1;
        const enemyGround = (opponent === 1 ? game.player1.groundArena : game.player2.groundArena).map(u => u.playId);
        if (enemyGround.length === 0) {
          return returnPending(afterVF, pending.continuation);
        }
        const spreadPending: SpreadDamagePending = {
          type: "spread-damage",
          cardId: "SHD_177",
          player: attacker.controller,
          totalDamage: 3,
          optional: true,
          eligiblePlayIds: enemyGround,
          continuation: vfCont as ResolveAttackPending,
        };
        const vfOption = {
          type: "ability-option" as const,
          cardId: "SHD_177",
          helperText: "Deal 3 damage divided among enemy ground units?",
          onYes: spreadPending,
          continuation: vfCont,
        };
        return { response: resolutionResponse(pendingToResolution(vfOption, game)), pending: vfOption, stateChanged: false };
      }
      case "native": {
        // Resolve the native on-attack trigger with remaining triggers as the new continuation
        const afterNative = buildRemaining(pending.continuation);
        const nativeCont = (afterNative ?? pending.continuation) as ResolveAttackPending;
        const nativePending = resolveOnAttackTrigger(attacker, nativeCont, { skipOrderingPrompt: true });
        return returnPending(nativePending, pending.continuation);
      }
    }
  }

  if (pending?.type === "trigger-order") {
    const chosen = pending.triggers.find(t => t.label === option);
    if (!chosen) {
      return { response: invalidResponse(`Unknown trigger option: ${option}`), pending, stateChanged: false };
    }
    // Remove the chosen trigger from the bag, preserving context (e.g. defeatedUnit for WD).
    const bagIdx = game.triggerBag.findIndex(t =>
      t.triggerType === chosen.triggerType && t.cardId === chosen.cardId && t.playId === chosen.playId,
    );
    const [originalTrigger] = bagIdx !== -1 ? game.triggerBag.splice(bagIdx, 1) : [];
    const trigger: TriggerEntry = originalTrigger ?? {
      triggerType: chosen.triggerType as TriggerEntry["triggerType"],
      cardId: chosen.cardId,
      fromPlayer: chosen.fromPlayer,
      playId: chosen.playId,
    };
    const nextPending = processSingleTrigger(trigger, game, log);
    if (nextPending) {
      if (nextPending.type === "attack-target" && nextPending.source === "ambush") {
        const ambushUnit = unitByPlayId(game, nextPending.attackerPlayId);
        if (ambushUnit) ambushUnit.ready = true;
      }
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    // This trigger auto-resolved — drain the rest of the bag.
    const bagPendingOrder = drainTriggerBag(game, log);
    if (bagPendingOrder) {
      return { response: resolutionResponse(pendingToResolution(bagPendingOrder, game)), pending: bagPendingOrder, stateChanged: false };
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
      const bagPending = drainTriggerBag(game, log);
      if (bagPending) {
        return { response: resolutionResponse(pendingToResolution(bagPending, game)), pending: bagPending, stateChanged: false };
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

    if (optionType === "put_into_play_as_resource") {
      const cardId = parts[0];
      const owner = Number(parts[1]) as PlayerId;
      ps(game, owner).resources.push({
        cardId,
        playId: nextPlayId(game),
        owner,
        controller: owner,
        ready: true,
        stolen: false,
      });
      log.push(`When Defeated: ${CardTitle(cardId)} entered play as a ready resource.`);
      const nextPending = pending.continuation ?? null;
      updateDefeatedPlayers(game);
      if (nextPending) {
        return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
      }
      const bagPending = drainTriggerBag(game, log);
      if (bagPending) {
        return { response: resolutionResponse(pendingToResolution(bagPending, game)), pending: bagPending, stateChanged: false };
      }
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    if (optionType === "move_to_ground_exhausted") {
      const cardId = parts[0];
      const owner = Number(parts[1]) as PlayerId;
      addToArena(game, owner, cardId, false); // ready=false → exhausted
      log.push(`When Defeated: ${CardTitle(cardId)} moved to the ground arena exhausted.`);
      const nextPending = pending.continuation ?? null;
      updateDefeatedPlayers(game);
      if (nextPending) {
        return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
      }
      const bagPending = drainTriggerBag(game, log);
      if (bagPending) {
        return { response: resolutionResponse(pendingToResolution(bagPending, game)), pending: bagPending, stateChanged: false };
      }
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    if (optionType === "decline") {
      const nextPending = pending.continuation ?? null;
      updateDefeatedPlayers(game);
      if (nextPending) {
        return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
      }
      const bagPending = drainTriggerBag(game, log);
      if (bagPending) {
        return { response: resolutionResponse(pendingToResolution(bagPending, game)), pending: bagPending, stateChanged: false };
      }
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    return { response: invalidResponse(`Unknown when-defeated option: ${optionType}`), pending, stateChanged: false };
  }

  if (pending?.type === "bounty") {
    if (option === "Yes") {
      if (pending.bountyEffect === "draw-card") {
        drawCardForPlayer(game, log, pending.collectingPlayer);
        const nextPending = pending.continuation ?? null;
        updateDefeatedPlayers(game);
        if (nextPending) {
          return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
        }
        return { response: stateResponse(game), pending: null, stateChanged: true };
      }
      if (pending.bountyEffect === "give-shield") {
        // Build a shield-target pending so the player chooses which unit gets the Shield token
        const allUnits = [...game.player1.groundArena, ...game.player1.spaceArena,
                          ...game.player2.groundArena, ...game.player2.spaceArena];
        const eligiblePlayIds = allUnits
          .filter(u => u.controller === pending.collectingPlayer)
          .map(u => u.playId);
        const shieldPending: BountyShieldTargetPending = {
          type: "bounty-shield-target",
          collectingPlayer: pending.collectingPlayer,
          fromPlayIds: eligiblePlayIds,
          continuation: pending.continuation ?? null,
        };
        return { response: resolutionResponse(pendingToResolution(shieldPending, game)), pending: shieldPending, stateChanged: false };
      }
    }
    // "No" — skip this bounty, move to continuation
    const nextPending = pending.continuation ?? null;
    updateDefeatedPlayers(game);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending?.type === "exploit-option") {
    if (option === "No") {
      const readyCount = ps(game, pending.playingPlayer).resources.filter(r => r.ready).length;
      if (readyCount < pending.fullCost) {
        // Can't afford without Exploit — return card to hand
        ps(game, pending.playingPlayer).hand.push({ cardId: pending.cardId });
        return { response: invalidResponse("Cannot afford this card without using Exploit."), pending: null, stateChanged: false };
      }
      exhaustResources(game, pending.playingPlayer, pending.fullCost);
      log.push(`Player ${pending.playingPlayer} played ${CardTitle(pending.cardId)} (Exploit declined).`);
      return completePlayCard(game, log, pending.cardId, pending.playingPlayer);
    }
    // "Yes" — prompt player to choose up to exploitAmount friendly units to defeat
    if (option === "Yes") {
      const friendlyUnits = [
        ...ps(game, pending.playingPlayer).groundArena,
        ...ps(game, pending.playingPlayer).spaceArena,
      ] as Unit[];
      const exploitTargetPending: ExploitTargetPending = {
        type: "exploit-target",
        cardId: pending.cardId,
        playingPlayer: pending.playingPlayer,
        exploitAmount: pending.exploitAmount,
        fullCost: pending.fullCost,
        fromPlayIds: friendlyUnits.map(u => u.playId),
      };
      return { response: resolutionResponse(pendingToResolution(exploitTargetPending, game)), pending: exploitTargetPending, stateChanged: false };
    }
  }

  if (pending?.type === "piloting-option" && pending.source === "hand") {
    if (option === "Play as Unit") {
      exhaustResources(game, pending.playingPlayer, pending.unitCost);
      log.push(`Player ${pending.playingPlayer} played ${CardTitle(pending.cardId)} as a unit.`);
      return completePlayCard(game, log, pending.cardId, pending.playingPlayer);
    }
    if (option === "Play as Pilot") {
      exhaustResources(game, pending.playingPlayer, pending.pilotingCost);
      log.push(`Player ${pending.playingPlayer} is playing ${CardTitle(pending.cardId)} as a Pilot.`);
      const eligibleVehicles = PilotingEligibleVehicles(game, pending.playingPlayer);
      const upgradePending: UpgradeTargetPending = {
        type: "upgrade-target",
        upgradeCardId: pending.cardId,
        player: pending.playingPlayer,
        fromPlayIds: eligibleVehicles,
      };
      return { response: resolutionResponse(pendingToResolution(upgradePending, game)), pending: upgradePending, stateChanged: false };
    }
  }

  if (pending?.type === "piloting-option" && pending.source === "leader") {
    const leader = ps(game, pending.playingPlayer).leader;
    if (option === "Deploy as Unit") {
      leader.deployed = true;
      const unit = addToArena(game, pending.playingPlayer, pending.cardId, true);
      leader.deployedPlayId = unit.playId;
      log.push(`Player ${pending.playingPlayer} deployed ${CardTitle(pending.cardId)} as a unit.`);
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }
    if (option === "Deploy as Pilot") {
      leader.deployed = true;
      log.push(`Player ${pending.playingPlayer} is deploying ${CardTitle(pending.cardId)} as a Pilot.`);
      const eligibleVehicles = PilotingEligibleVehicles(game, pending.playingPlayer);
      const upgradePending: UpgradeTargetPending = {
        type: "upgrade-target",
        upgradeCardId: pending.cardId,
        player: pending.playingPlayer,
        fromPlayIds: eligibleVehicles,
      };
      return { response: resolutionResponse(pendingToResolution(upgradePending, game)), pending: upgradePending, stateChanged: false };
    }
  }

  if (pending?.type === "plot-order") {
    if (option === "Plot First") {
      const plotPending: PlotWindowPending = {
        type: "plot-window",
        player: pending.player,
        leaderCardId: pending.leaderCardId,
        plotResourcePlayIds: getAffordablePlotPlayIds(game, pending.player),
        fireWhenDeployedAfter: true,
      };
      return { response: resolutionResponse(pendingToResolution(plotPending, game)), pending: plotPending, stateChanged: false };
    }
    if (option === "When Deployed First") {
      resolveWhenDeployed(pending.leaderCardId, pending.player, log);
      updateDefeatedPlayers(game);
      const plotPending: PlotWindowPending = {
        type: "plot-window",
        player: pending.player,
        leaderCardId: pending.leaderCardId,
        plotResourcePlayIds: getAffordablePlotPlayIds(game, pending.player),
        fireWhenDeployedAfter: false,
      };
      return { response: resolutionResponse(pendingToResolution(plotPending, game)), pending: plotPending, stateChanged: true };
    }
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
    saboteurApplied: pending.saboteurApplied,
  };
  const nextPending = resolveAttack(game, log, attackPending, pending.target);
  updateDefeatedPlayers(game);
  if (nextPending) {
    return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
  }
  const bagPendingResolve = drainTriggerBag(game, log);
  if (bagPendingResolve) {
    return { response: resolutionResponse(pendingToResolution(bagPendingResolve, game)), pending: bagPendingResolve, stateChanged: false };
  }
  return { response: stateResponse(game), pending: null, stateChanged: true };
}

function handlePassAction(game: GameState, log: string[], dispatch: GameDispatch): HandlerResult {
  log.push(`Player ${dispatch.fromPlayer} passed their action.`);
  const triggerPending = drainTriggerBag(game, log);
  if (triggerPending) {
    return { response: resolutionResponse(pendingToResolution(triggerPending, game)), pending: triggerPending, stateChanged: false };
  }
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

/**
 * Called after every successful top-level action to advance the active player
 * and detect action-phase end.
 *
 * Phase ends when both players pass consecutively (CR 1.15.6d), which includes
 * the case where one player passes then the other claims initiative (CR 1.15.5c).
 *
 * When initiative has been claimed, the holder auto-passes on their subsequent
 * turns — they never take real actions again this phase (CR 1.15.5b).
 */
function advanceTurn(game: GameState, log: string[], wasPass: boolean): void {
  const prevWasPass = game.roundState.lastActionWasPass;
  game.roundState.lastActionWasPass = wasPass;

  // Consecutive passes → action phase ends.
  if (wasPass && prevWasPass) {
    game.gamePhase = "RegroupDraw";
    log.push("Both players passed consecutively. Action phase ended.");
    executeRegroupDraw(game, log);
    updateDefeatedPlayers(game);
    return;
  }

  // Switch active player.
  game.activePlayer = game.activePlayer === 1 ? 2 : 1;

  // If the new active player has claimed initiative, auto-pass for them.
  if (game.initiativeClaimed && game.activePlayer === game.initiativePlayer) {
    log.push(`Player ${game.activePlayer} auto-passes (initiative claimed).`);
    // This auto-pass + the previous action being a pass → consecutive → phase ends.
    if (wasPass) {
      game.gamePhase = "RegroupDraw";
      log.push("Action phase ended.");
      executeRegroupDraw(game, log);
      updateDefeatedPlayers(game);
      return;
    }
    game.roundState.lastActionWasPass = true;
    game.activePlayer = game.activePlayer === 1 ? 2 : 1;
  }
}

// ---------------------------------------------------------------------------
// Leader helpers
// ---------------------------------------------------------------------------

/** Returns playIds of Plot-eligible resources the player can currently afford (aspect penalties included). */
function getAffordablePlotPlayIds(game: GameState, player: PlayerId): string[] {
  return ps(game, player).resources
    .filter(r => HasPlot(r.cardId) && canAfford(game, player, r.cardId))
    .map(r => r.playId);
}

function leaderHasWhenDeployed(cardId: string): boolean {
  switch (cardId) {
    case "SHD_002": return true;
    default: return false;
  }
}

function injectContinuation(
  p: PendingResolution,
  cont: PendingResolution | null,
): PendingResolution {
  if (cont === null) return p;
  if ("continuation" in p && p.continuation !== undefined) {
    if (p.continuation === null) return { ...p, continuation: cont } as PendingResolution;
    return { ...p, continuation: injectContinuation(p.continuation, cont) } as PendingResolution;
  }
  return p;
}

function deployLeader(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const leader = ps(game, player).leader;
  if (leader.deployed)
    return { response: invalidResponse("Leader is already deployed."), pending: null, stateChanged: false };
  if (leader.epicActionUsed)
    return { response: invalidResponse("Leader epic action already used this round."), pending: null, stateChanged: false };

  const deployCost = playCost(game, player, leader.cardId);
  if (ps(game, player).resources.length < deployCost)
    return { response: invalidResponse("Not enough resources to deploy leader."), pending: null, stateChanged: false };

  // Check if this leader can also deploy as a pilot upgrade on a Vehicle
  const pilotThreshold = LeaderDeployPilotThreshold(leader.cardId);
  if (pilotThreshold !== null) {
    const eligibleVehicles = PilotingEligibleVehicles(game, player);
    if (eligibleVehicles.length > 0) {
      leader.epicActionUsed = true;
      log.push(`Player ${player} is deploying ${CardTitle(leader.cardId)} — choose unit or pilot.`);
      const pilotingOptionPending: PilotingOptionPending = {
        type: "piloting-option",
        cardId: leader.cardId,
        playingPlayer: player,
        unitCost: deployCost,
        pilotingCost: deployCost,
        source: "leader",
      };
      return { response: resolutionResponse(pendingToResolution(pilotingOptionPending, game)), pending: pilotingOptionPending, stateChanged: false };
    }
  }

  // Normal deploy path
  leader.deployed = true;
  leader.epicActionUsed = true;
  const unit = addToArena(game, player, leader.cardId, true);
  leader.deployedPlayId = unit.playId;
  log.push(`Player ${player} deployed ${CardTitle(leader.cardId) ?? leader.cardId}.`);

  const plotPlayIds = getAffordablePlotPlayIds(game, player);
  const hasWD = leaderHasWhenDeployed(leader.cardId);

  if (plotPlayIds.length > 0 && hasWD) {
    const orderPending: PlotOrderPending = {
      type: "plot-order",
      player,
      leaderCardId: leader.cardId,
      plotResourcePlayIds: plotPlayIds,
    };
    return { response: resolutionResponse(pendingToResolution(orderPending, game)), pending: orderPending, stateChanged: true };
  }

  if (plotPlayIds.length > 0) {
    const plotPending: PlotWindowPending = {
      type: "plot-window",
      player,
      leaderCardId: leader.cardId,
      plotResourcePlayIds: plotPlayIds,
      fireWhenDeployedAfter: false,
    };
    updateDefeatedPlayers(game);
    return { response: resolutionResponse(pendingToResolution(plotPending, game)), pending: plotPending, stateChanged: true };
  }

  const whenDeployedPending = resolveWhenDeployed(leader.cardId, player, log);
  updateDefeatedPlayers(game);
  if (whenDeployedPending) {
    return { response: resolutionResponse(pendingToResolution(whenDeployedPending, game)), pending: whenDeployedPending, stateChanged: true };
  }
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
    case "TWI_005": { // Count Dooku — Action [Exhaust]: Play a Separatist card from your hand. It gains Exploit 1.
      const separatistInHand = ps(game, player).hand.some(c => CardTraits(c.cardId).includes("Separatist"));
      if (!separatistInHand) {
        log.push(`${CardTitle("TWI_005")}: no Separatist cards in hand.`);
        return null;
      }
      return { type: "dooku-leader-play", player } satisfies DookuLeaderPlayPending;
    }
    case "SOR_014": // Sabine Wren - Galvanized Revolutionary: Deal 1 damage to each base.
      game.player1.base.damage += 1;
      game.player2.base.damage += 1;
      log.push(`${CardTitle(cardId)} dealt 1 damage to each base.`);
      return null;
    case "SHD_012": { // Bo-Katan Kryze - Princess in Exile: If a Mandalorian attacked this phase, deal 1 damage to a unit.
      if (!UnitAttackedThisPhase(player, "Mandalorian")) {
        log.push(`${CardTitle(cardId)}: no Mandalorian attacked this phase — soft pass.`);
        return null;
      }
      const allUnits012 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      if (allUnits012.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allUnits012.map(u => u.playId),
        continuation: null,
      };
    }
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
    case "SOR_108": { // Vanguard Infantry when-defeated: give Experience token to chosen unit
      if (!targetPlayId) break;
      const target108 = unitByPlayId(game.currentGameState, targetPlayId);
      if (target108) {
        target108.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target108.owner, controller: target108.controller });
        game.gameLog.push(`${CardTitle("SOR_108")}: gave an Experience token to ${CardTitle(target108.cardId)}.`);
      }
      break;
    }
    case "SOR_121": { // Hardpoint Heavy Blaster on-attack: deal 2 damage to chosen unit in defender's arena
      if (!targetPlayId) break;
      const target121 = unitByPlayId(game.currentGameState, targetPlayId);
      if (target121) {
        target121.damage += 2;
        game.gameLog.push(`${CardTitle("SOR_121")}: dealt 2 damage to ${CardTitle(target121.cardId)}.`);
      }
      return pending.continuation;
    }
    case "SOR_226": { // Admiral Motti when-defeated: ready chosen Villainy unit
      if (!targetPlayId) break;
      const target226 = unitByPlayId(game.currentGameState, targetPlayId);
      if (target226) {
        target226.ready = true;
        game.gameLog.push(`${CardTitle("SOR_226")}: readied ${CardTitle(target226.cardId)}.`);
      }
      break;
    }
    case "SHD_012": // Bo-Katan Kryze leader action: deal 1 damage to chosen unit
    case "SHD_012_1": // Bo-Katan deployed on-attack: first 1-damage shot
    case "SHD_012_2": { // Bo-Katan deployed on-attack: second 1-damage shot (another Mandalorian attacked)
      if (!targetPlayId) break;
      const target012 = unitByPlayId(game.currentGameState, targetPlayId);
      if (target012) {
        target012.damage += 1;
        game.gameLog.push(`${CardTitle("SHD_012")}: dealt 1 damage to ${CardTitle(target012.cardId)}.`);
      }
      break;
    }
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
    case "SOR_077": { // Takedown — defeat a unit with ≤5 remaining HP
      if (!targetPlayId) break;
      const target077 = unitByPlayId(game.currentGameState, targetPlayId);
      if (!target077) break;
      if (Unit.FromInterface(target077).CurrentHP() > 5) break;
      const defeatPend077 = defeatUnit(game.currentGameState, game.gameLog, target077);
      game.gameLog.push(`${CardTitle(pending.cardId)} defeated ${CardTitle(target077.cardId)}.`);
      if (defeatPend077) return injectContinuation(defeatPend077, pending.continuation);
      return pending.continuation;
    }
    case "SEC_034": { // Cad Bane — defeat a unit with ≤2 remaining HP
      if (!targetPlayId) break;
      const target034 = unitByPlayId(game.currentGameState, targetPlayId);
      if (!target034) break;
      const target034Unit = Unit.FromInterface(target034);
      if (target034Unit.CurrentHP() > 2) break;
      const defeatPend = defeatUnit(game.currentGameState, game.gameLog, target034);
      game.gameLog.push(`${CardTitle(pending.cardId)} defeated ${CardTitle(target034.cardId)}.`);
      if (defeatPend) return injectContinuation(defeatPend, pending.continuation);
      return pending.continuation;
    }
    case "SOR_224": { // Change of Heart — take control of a non-leader unit (reverts at start of regroup)
      if (!targetPlayId || !pending.player) break;
      const unit224 = unitByPlayId(game.currentGameState, targetPlayId);
      if (!unit224 || CardIsLeader(unit224.cardId)) break;
      const originalOwner = unit224.owner;
      transferControl(game.currentGameState, game.gameLog, unit224, pending.player);
      // Record the revert — owner reclaims control at the start of the regroup phase.
      game.currentGameState.currentEffects.push({
        cardId: "SOR_224",
        duration: "UntilStartOfRegroup",
        affectedPlayer: originalOwner,
        targetPlayId: unit224.playId,
      });
      break;
    }
    case "SOR_073": { // Moment of Peace — "Give a Shield token to a unit."
      if (!targetPlayId) break;
      const target073 = unitByPlayId(game.currentGameState, targetPlayId);
      if (!target073) break;
      target073.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game.currentGameState), owner: target073.owner, controller: target073.controller });
      game.gameLog.push(`${CardTitle(pending.cardId)}: Shield token placed on ${CardTitle(target073.cardId)}.`);
      break;
    }
    case "SOR_241": { // Wing Leader — "Give 2 Experience tokens to another friendly REBEL unit."
      if (!targetPlayId) break;
      const target241 = unitByPlayId(game.currentGameState, targetPlayId);
      if (!target241) break;
      target241.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target241.owner, controller: target241.controller });
      target241.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target241.owner, controller: target241.controller });
      game.gameLog.push(`${CardTitle(pending.cardId)}: 2 Experience tokens given to ${CardTitle(target241.cardId)}.`);
      break;
    }
    case "SOR_222": { // Waylay — "Return a non-leader unit to its owner's hand."
      if (!targetPlayId) break;
      const waylayResult = removeFromArena(game.currentGameState, targetPlayId);
      if (!waylayResult) break;
      const { unit: bouncedUnit } = waylayResult;
      // Tokens are defeated (set aside) when bounced — they cannot return to hand (CR 7.6.1).
      if (bouncedUnit.IsTokenUnit()) {
        game.gameLog.push(`Waylay: ${CardTitle(bouncedUnit.cardId)} set aside (token).`);
        break;
      }
      // Return unit to its owner's hand (without upgrades — they're defeated).
      ps(game.currentGameState, bouncedUnit.owner).hand.push({ cardId: bouncedUnit.cardId });
      game.gameLog.push(`Waylay: ${CardTitle(bouncedUnit.cardId)} returned to Player ${bouncedUnit.owner}'s hand.`);
      // Check for Luke Skywalker (JTL_094) as a pilot upgrade — his eject ability fires.
      const waylayLuke = bouncedUnit.upgrades.find(upg => upg.cardId === "JTL_094");
      if (waylayLuke) {
        return {
          type: "when-defeated-choice",
          defeatedCardId: "JTL_094",
          defeatedPlayId: waylayLuke.playId,
          controlledBy: waylayLuke.controller as PlayerId,
          options: [`move_to_ground_exhausted=JTL_094,${waylayLuke.controller}`, "decline"],
          continuation: pending.continuation ?? null,
        };
      }
      break;
    }
    case "SOR_150": { // Heroic Sacrifice — chosen unit attacks with +2/+0; dies after dealing combat damage
      if (!targetPlayId || !pending.player) break;
      const gs150 = game.currentGameState;
      gs150.currentEffects.push({ cardId: "SOR_150", duration: "ForAttack", affectedPlayer: pending.player, targetPlayId });
      gs150.currentEffects.push({ cardId: "SOR_150_sacrifice", duration: "ForAttack", affectedPlayer: pending.player, targetPlayId });
      return { type: "attack-target", attackerPlayId: targetPlayId, source: "SOR_150", continuation: null };
    }
    case "SHD_132": { // Choose Sides — step 1: chose friendly unit, now prompt for enemy non-leader
      if (!targetPlayId || !pending.player) break;
      const enemyPlayer132 = otherPlayer(pending.player);
      const enemyUnits132 = GetUnitsForPlayer(enemyPlayer132).filter(u => !CardIsLeader(u.cardId));
      if (enemyUnits132.length === 0) break;
      return {
        type: "ability-target",
        cardId: "SHD_132_swap",
        player: pending.player,
        sourcePlayId: targetPlayId,
        fromPlayIds: enemyUnits132.map(u => u.playId),
        continuation: null,
      };
    }
    case "SHD_132_swap": { // Choose Sides — step 2: exchange control of both units (permanent)
      if (!targetPlayId || !pending.sourcePlayId || !pending.player) break;
      const gs132 = game.currentGameState;
      const friendlyUnit = unitByPlayId(gs132, pending.sourcePlayId);
      const enemyUnit = unitByPlayId(gs132, targetPlayId);
      if (!friendlyUnit || !enemyUnit) break;
      const friendlyOriginalController = friendlyUnit.controller;
      const enemyOriginalController = enemyUnit.controller;
      transferControl(gs132, game.gameLog, friendlyUnit, enemyOriginalController);
      transferControl(gs132, game.gameLog, enemyUnit, friendlyOriginalController);
      break;
    }
    case "SOR_127": { // Strike True — step 1: chose friendly unit, now prompt for enemy target
      if (!targetPlayId || !pending.player) break;
      const enemyPlayer127 = otherPlayer(pending.player);
      const enemyUnits127 = GetUnitsForPlayer(enemyPlayer127);
      if (enemyUnits127.length === 0) break;
      return {
        type: "ability-target",
        cardId: "SOR_127_deal",
        player: pending.player,
        sourcePlayId: targetPlayId,
        fromPlayIds: enemyUnits127.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_127_deal": { // Strike True — step 2: deal power damage to chosen enemy unit
      if (!targetPlayId || !pending.sourcePlayId) break;
      const attacker127 = unitByPlayId(game.currentGameState, pending.sourcePlayId);
      const target127 = unitByPlayId(game.currentGameState, targetPlayId);
      if (!attacker127 || !target127) break;
      const power127 = Unit.FromInterface(attacker127).CurrentPower();
      target127.damage += power127;
      game.gameLog.push(`Strike True: ${CardTitle(attacker127.cardId)} dealt ${power127} damage to ${CardTitle(target127.cardId)}.`);
      break;
    }
    case "SOR_162": //Disabling Fang Fighter
    case "SHD_166": //reprint of SOR_162
    case "SOR_251": { // Confiscate — defeat an upgrade
      if (!targetPlayId) break;
      const allGameUnits = allUnits(game.currentGameState);
      let lukeConfiscated: { cardId: string; playId: string; controller: number } | null = null;
      for (const u of allGameUnits) {
        const upgradeIdx = u.upgrades.findIndex(upg => upg.playId === targetPlayId);
        if (upgradeIdx !== -1) {
          const [defeated] = u.upgrades.splice(upgradeIdx, 1);
          game.gameLog.push(`Confiscate defeated ${CardTitle(defeated.cardId)} on ${CardTitle(u.cardId)}.`);
          // Traitorous unattach: owner reclaims control when the upgrade is removed.
          if (defeated.cardId === "SOR_122" && u.controller !== u.owner) {
            transferControl(game.currentGameState, game.gameLog, u, u.owner);
          }
          // Luke Skywalker eject: when defeated as a pilot upgrade, he may move to ground.
          if (defeated.cardId === "JTL_094") {
            lukeConfiscated = { cardId: defeated.cardId, playId: defeated.playId, controller: defeated.controller };
          }
          break;
        }
      }
      if (lukeConfiscated) {
        return {
          type: "when-defeated-choice",
          defeatedCardId: "JTL_094",
          defeatedPlayId: lukeConfiscated.playId,
          controlledBy: lukeConfiscated.controller as PlayerId,
          options: [`move_to_ground_exhausted=JTL_094,${lukeConfiscated.controller}`, "decline"],
          continuation: pending.continuation ?? null,
        };
      }
      break;
    }
    case "SHD_008": { // Boba Fett leader reaction: exhaust leader, give chosen unit +1/+0 for this phase
      if (!targetPlayId) break;
      const gs008 = game.currentGameState;
      ps(gs008, pending.player!).leader.ready = false;
      gs008.currentEffects.push({
        cardId: "SHD_008",
        duration: "Phase",
        affectedPlayer: pending.player!,
        targetPlayId,
      });
      const target008 = unitByPlayId(gs008, targetPlayId);
      game.gameLog.push(
        `Boba Fett: gave +1/+0 to ${CardTitle(target008?.cardId ?? "") ?? targetPlayId} for this phase.`
      );
      break;
    }
    case "SOR_106_3": { // Attack Pattern Delta — step 1: give chosen unit +3/+3 for this phase
      if (!targetPlayId) break;
      const gs3 = game.currentGameState;
      gs3.currentEffects.push({ cardId: "SOR_106_3", duration: "Phase", affectedPlayer: pending.player!, targetPlayId });
      const t3 = unitByPlayId(gs3, targetPlayId);
      game.gameLog.push(`Attack Pattern Delta: ${CardTitle(t3?.cardId ?? "") ?? targetPlayId} gets +3/+3 for this phase.`);
      // Rebuild step-2 fromPlayIds excluding the just-chosen unit
      const fresh2 = GetUnitsForPlayer(pending.player!).filter(u => u.playId !== targetPlayId).map(u => u.playId);
      if (fresh2.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_106_2",
        player: pending.player,
        fromPlayIds: fresh2,
        continuation: {
          type: "ability-target",
          cardId: "SOR_106_1",
          player: pending.player,
          fromPlayIds: fresh2, // stale — refreshed in SOR_106_2 handler
          continuation: null,
        },
      };
    }
    case "SOR_106_2": { // Attack Pattern Delta — step 2: give chosen unit +2/+2 for this phase
      if (!targetPlayId) break;
      const gs2 = game.currentGameState;
      gs2.currentEffects.push({ cardId: "SOR_106_2", duration: "Phase", affectedPlayer: pending.player!, targetPlayId });
      const t2 = unitByPlayId(gs2, targetPlayId);
      game.gameLog.push(`Attack Pattern Delta: ${CardTitle(t2?.cardId ?? "") ?? targetPlayId} gets +2/+2 for this phase.`);
      // Rebuild step-3 fromPlayIds excluding units already tagged (SOR_106_3) plus current pick
      const alreadyPicked = new Set(
        gs2.currentEffects
          .filter(e => e.cardId === "SOR_106_3" && e.targetPlayId)
          .map(e => e.targetPlayId!)
      );
      alreadyPicked.add(targetPlayId);
      const fresh1 = GetUnitsForPlayer(pending.player!).filter(u => !alreadyPicked.has(u.playId)).map(u => u.playId);
      if (fresh1.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_106_1",
        player: pending.player,
        fromPlayIds: fresh1,
        continuation: null,
      };
    }
    case "SOR_106_1": { // Attack Pattern Delta — step 3: give chosen unit +1/+1 for this phase
      if (!targetPlayId) break;
      const gs1 = game.currentGameState;
      gs1.currentEffects.push({ cardId: "SOR_106_1", duration: "Phase", affectedPlayer: pending.player!, targetPlayId });
      const t1 = unitByPlayId(gs1, targetPlayId);
      game.gameLog.push(`Attack Pattern Delta: ${CardTitle(t1?.cardId ?? "") ?? targetPlayId} gets +1/+1 for this phase.`);
      break;
    }
    case "SOR_092": { // Overwhelming Barrage — +2/+2 and spread power damage
      if (!targetPlayId) break;
      const target092 = unitByPlayId(game.currentGameState, targetPlayId);
      if (!target092) break;

      // Push +2/+2 current effect on the chosen unit
      game.currentGameState.currentEffects.push({
        cardId: "SOR_092",
        duration: "Phase",
        affectedPlayer: pending.player!,
        targetPlayId,
      });

      // Read buffed power (includes the +2 just applied)
      const buffedPower = Unit.FromInterface(target092).CurrentPower();

      // Eligible: all units except the chosen unit
      const allUnits092 = [
        ...game.currentGameState.player1.groundArena,
        ...game.currentGameState.player1.spaceArena,
        ...game.currentGameState.player2.groundArena,
        ...game.currentGameState.player2.spaceArena,
      ].filter(u => u.playId !== targetPlayId);

      game.gameLog.push(`${CardTitle("SOR_092")}: ${CardTitle(target092.cardId)} gets +2/+2 and deals ${buffedPower} damage spread among other units.`);

      if (allUnits092.length === 0 || buffedPower === 0) return pending.continuation;

      const spreadPending092: SpreadDamagePending = {
        type: "spread-damage",
        cardId: "SOR_092",
        player: pending.player!,
        totalDamage: buffedPower,
        optional: false,
        eligiblePlayIds: allUnits092.map(u => u.playId),
        continuation: pending.continuation,
      };
      return spreadPending092;
    }
    default:
      game.gameLog.push(`Ability effect for ${CardTitle(pending.cardId) ?? pending.cardId} applied.`);
      break;
  }
  return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
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

    // Reject all actions once the game is over.
    if (gs.defeatedPlayers.length > 0) {
      return { response: invalidResponse("The game is over."), context };
    }

    const ACTION_STARTERS = [
      "play-card", "play-smuggle", "initiate-attack", "use-ability", "pass-action", "claim-initiative",
    ] as const;
    const isTopLevelAction = (ACTION_STARTERS as readonly string[]).includes(dispatch.dispatchType);

    // Enforce turn order: only the active player may take top-level actions.
    if (isTopLevelAction && dispatch.fromPlayer !== gs.activePlayer) {
      result = { response: invalidResponse("It is not your turn."), pending, stateChanged: false };
    } else {
      switch (dispatch.dispatchType) {
        case "play-card":         result = handlePlayCard(gs, log, dispatch); break;
        case "play-smuggle":      result = handlePlaySmuggle(gs, log, dispatch); break;
        case "initiate-attack":   result = handleInitiateAttack(gs, log, dispatch); break;
        case "use-ability":       result = handleUseAbility(gs, log, dispatch); break;
        case "pass-action":       result = handlePassAction(gs, log, dispatch); break;
        case "claim-initiative":  result = handleClaimInitiative(gs, log, dispatch); break;
        case "choose-target":     result = handleChooseTarget(gs, log, dispatch, pending); break;
        case "choose-option":     result = handleChooseOption(gs, log, dispatch, pending); break;
        case "regroup-resource": {
          const data = dispatch.dispatchData as RegroupResourceDispatchData;
          const err = tryRegroupResource(gs, log, dispatch.fromPlayer, data.handIndex);
          result = err
            ? { response: invalidResponse(err), pending: null, stateChanged: false }
            : { response: stateResponse(gs), pending: null, stateChanged: true };
          break;
        }
        case "pass-resource": {
          const err = tryPassResource(gs, log, dispatch.fromPlayer);
          result = err
            ? { response: invalidResponse(err), pending: null, stateChanged: false }
            : { response: stateResponse(gs), pending: null, stateChanged: true };
          break;
        }
        case "choose-player":
        case "choose-trigger":
          // Reserved for future trigger-bag resolution
          result = { response: invalidResponse(`${dispatch.dispatchType} not yet implemented.`), pending, stateChanged: false };
          break;
        default:
          result = { response: invalidResponse(`Unknown dispatch type.`), pending: null, stateChanged: false };
      }

      // After a successful top-level action, advance the turn.
      if (isTopLevelAction && !result.response.invalidAction) {
        const wasPass = dispatch.dispatchType === "pass-action" || dispatch.dispatchType === "claim-initiative";
        advanceTurn(gs, log, wasPass);
      }
    }

    // Snapshot the pre-dispatch state before top-level actions (play-card, initiate-attack,
    // use-ability, pass-action, claim-initiative). Resolution steps (choose-target, choose-option,
    // etc.) are part of the same logical action and must NOT add extra snapshots — doing so would
    // cause multi-step actions like Precision Fire to require multiple undos.
    const shouldSnapshot =
      isTopLevelAction &&
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
