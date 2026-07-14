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
  CardPower,
  CardSubtitle,
  CardTitle,
  CardTraits,
  CardType,
  CardUpgradeHp,
  CardUpgradePower,
} from "@/server/engine/card-db/generated";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { GetAllUnits, CardIsLeader, CardsCanDisclose, DealDamageToUnit, DrawCardForPlayer, GetGame, GetUnitsForPlayer, HasOnAttack, GetOtherPlayer, GetPlayer, SetGame, TraitContains, UnitAttackedThisPhase, UnitWasDefeatedThisPhase, GetUnitByPlayId, AllGroundUnits, PlayerHasUnitWithTraitInPlay, PlayerHasUnitWithAspectInPlay, CreateForceToken, UseTheForce, GetLeaderForPlayer, HealBaseForPlayer } from "@/server/engine/core-functions";
import { Unit } from "@/server/engine/unit";

import type {
  ChooseOptionDispatchData,
  ChooseTargetDispatchData,
  DispatchResponse,
  GameDispatch,
  InitiateAttackDispatchData,
  NeedsDeckSearch,
  NeedsOption,
  NeedsPlot,
  NeedsSpreadDamage,
  NeedsTarget,
  NeedsPeekHand,
  NeedsRevealDiscard,
  NeedsDontGetCocky,
  PlayCardDispatchData,
  PlaySmuggleDispatchData,
  RegroupResourceDispatchData,
  ResolutionRequest,
  UseAbilityDispatchData,
} from "@/lib/engine/message-types";
import { effectiveSmuggleCost, spendableFor } from "@/server/engine/card-playability";
import type { Game, GameState } from "@/lib/engine/game";
import type { CardInPlay, CurrentEffect, DiscardedCard, PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";
import type {
  AbilityOptionPending,
  AbilityTargetPending,
  AttackTargetPending,
  DefeatCopyPending,
  DontGetCockyPending,
  DiscardFromHandPending,
  IndirectDamagePending,
  EngineContext,
  ExploitOptionPending,
  ExploitTargetPending,
  CreditPaymentOptionPending,
  CreditPaymentAmountPending,
  ChooseOnePending,
  OnAttackOrderPending,
  OnAttackTriggerEntry,
  PendingResolution,
  PilotingOptionPending,
  PlayFromHandPending,
  PlotOrderPending,
  PlotWindowPending,
  ResolveAttackPending,
  MillPending,
  MillResultPending,
  SpreadDamagePending,
  SpreadHealPending,
  TriggerOrderPending,
  TriggerPlayerOrderPending,
  UpgradeTargetPending,
  BamboozleAltCostPending,
  BamboozleAltCostDiscardPending,
  ChooseAspectEffectPending,
} from "@/server/engine/pending-resolution";
import type { TriggerEntry, CardPlayedContext } from "@/lib/engine/trigger-types";
import { collectBounties } from "@/server/engine/actions/bounty";
import { resolveWhenDefeated } from "@/server/engine/actions/when-defeated";
import { UpgradeEligibleTargets } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { resolveWhenPlayed, shatterpointModeA, shatterpointModeB } from "@/server/engine/actions/when-played";
import { executeRegroupDraw, tryRegroupResource, tryPassResource } from "@/server/engine/actions/regroup";
import { resolveWhenPlayedTrigger } from "@/server/engine/actions/when-played-trigger";
import { resolveOnAttackTrigger } from "@/server/engine/actions/on-attack";
import { chooseEnemyForPowerDamage, dealPowerToEnemy } from "@/server/engine/actions/deal-power-damage";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { ActionAbilities, ActionAbilityCost } from "@/server/engine/actions/action-ability";
import { ExploitAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/exploit";
import { PilotingCost } from "@/server/engine/card-db/keyword-dictionaries.ts/piloting";
import { PilotingEligibleVehicles } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { LeaderDeployPilotThreshold } from "@/server/engine/card-db/keyword-dictionaries.ts/leader-pilot-deploy";
import { HasPlot } from "@/server/engine/card-db/keyword-dictionaries.ts/plot";
import { resolveWhenDeployed } from "@/server/engine/actions/when-deployed";
import { applyDarksaberOnAttack } from "./on-attack-helper";
import { CreateSpy, CreateCreditToken } from "@/server/engine/token-helpers";

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

export function computeUnitBuffs(gs: GameState): Record<string, { power: number; hp: number }> {
  const units = [
    ...gs.player1.groundArena, ...gs.player1.spaceArena,
    ...gs.player2.groundArena, ...gs.player2.spaceArena,
  ];
  const result: Record<string, { power: number; hp: number }> = {};
  for (const u of units) {
    try {
      const unit = Unit.FromInterface(u);
      const basePower = CardPower(u.cardId) || 0;
      const baseHp = CardHp(u.cardId) || 0;
      const upgPow = u.upgrades.reduce((sum, upg) => sum + (CardUpgradePower(upg.cardId) || 0), 0);
      const upgHp = u.upgrades.reduce((sum, upg) => sum + (CardUpgradeHp(upg.cardId) || 0), 0);
      const powBuff = unit.CurrentPower() - basePower - upgPow;
      const hpBuff = unit.TotalHP() - baseHp - upgHp;
      if (powBuff > 0 || hpBuff > 0) {
        result[u.playId] = { power: powBuff, hp: hpBuff };
      }
    } catch { /* skip if unit state is inconsistent */ }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers: game state accessors
// ---------------------------------------------------------------------------

/**
 * Resolves the mode a player picked from a card's "Choose one:" prompt. Each mode returns
 * the pending it needs next (usually a target step), or null when it resolves outright.
 */
function resolveChooseOne(
  game: GameState,
  log: string[],
  pending: ChooseOnePending,
  optionId: string,
): PendingResolution | null {
  let next: PendingResolution | null = null;
  switch (pending.cardId) {
    case "LOF_079": // Shatterpoint
      next = optionId === "defeat_low_hp"
        ? shatterpointModeA(pending.cardId, pending.player)
        : shatterpointModeB(pending.cardId, pending.player, log);
      break;
    default:
      log.push(`No "Choose one" handler for ${CardTitle(pending.cardId)}.`);
      break;
  }
  return next ? injectContinuation(next, pending.continuation) : pending.continuation;
}

function sweepDeadUnits(gs: GameState, log: string[], continuation: PendingResolution | null): PendingResolution | null {
  let pending = continuation;
  for (const unit of GetAllUnits(gs)) {
    if (Unit.FromInterface(unit).CurrentHP() <= 0) {
      const defeatPend = defeatUnit(gs, log, unit);
      if (defeatPend) pending = injectContinuation(defeatPend, pending);
    }
  }
  return pending;
}

// ---------------------------------------------------------------------------
// Helpers: resources & cost
// ---------------------------------------------------------------------------

function aspectPenalty(game: GameState, player: PlayerId, cardId: string): number {
  const playerState = GetPlayer(game, player);

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

function delMeekoEventTax(game: GameState, player: PlayerId, cardId: string): number {
  if (CardType(cardId) !== "Event") return 0;
  const opp = GetOtherPlayer(player);
  const oppUnits = [...GetPlayer(game, opp).groundArena, ...GetPlayer(game, opp).spaceArena];
  return oppUnits.some(u => u.cardId === "SOR_034" && !Unit.FromInterface(u).LostAbilities()) ? 1 : 0;
}

function guardianOfTheWhillsDiscount(game: GameState, player: PlayerId, cardId: string): number {
  if (CardType(cardId) !== "Upgrade") return 0;
  const p = GetPlayer(game, player);
  const eligibleTargets = UpgradeEligibleTargets(cardId, game, player);
  const hasEligibleGuardian = [...p.groundArena, ...p.spaceArena].some(u => {
    if (u.cardId !== "SOR_061" && u.cardId !== "LOF_058") return false;
    if (Unit.FromInterface(u).LostAbilities()) return false;
    if (game.currentEffects.some(e => e.cardId === "SOR_061_firstUpgradeUsed" && e.targetPlayId === u.playId && e.affectedPlayer === player)) return false;
    return eligibleTargets.includes(u.playId);
  });
  return hasEligibleGuardian ? 1 : 0;
}

// SOR_139 Force Choke: costs 1 less if you control a Force unit.
function forceChokeDiscount(game: GameState, player: PlayerId, cardId: string): number {
  if (cardId !== "SOR_139") return 0;
  const p = GetPlayer(game, player);
  return [...p.groundArena, ...p.spaceArena].some(
    u => CardTraits(u.cardId).includes("Force") && !Unit.FromInterface(u).LostAbilities(),
  ) ? 1 : 0;
}

function jabbaTheTrickDiscount(game: GameState, player: PlayerId, cardId: string): number {
  if (CardType(cardId) !== "Event" || !CardTraits(cardId).includes("Trick")) return 0;
  const p = GetPlayer(game, player);
  return [...p.groundArena, ...p.spaceArena].some(
    u => u.cardId === "SOR_181" && !Unit.FromInterface(u).LostAbilities(),
  ) ? 1 : 0;
}

// SOR_056 Bendu: next non-Heroism non-Villainy card costs 2 less (consumed on use).
function benduDiscount(game: GameState, player: PlayerId, cardId: string): number {
  if (CardAspects(cardId).includes("Heroism") || CardAspects(cardId).includes("Villainy")) return 0;
  return game.currentEffects.some(e => e.cardId === "SOR_056" && e.affectedPlayer === player) ? 2 : 0;
}

// SEC_110 GNK Power Droid: next unit costs 1 less (consumed when a unit is played).
function gnkPowerDroidDiscount(game: GameState, player: PlayerId, cardId: string): number {
  if (CardType(cardId) !== "Unit") return 0;
  return game.currentEffects.some(e => e.cardId === "SEC_110" && e.affectedPlayer === player) ? 1 : 0;
}

function playCost(game: GameState, player: PlayerId, cardId: string): number {
  return CardCost(cardId)
    + aspectPenalty(game, player, cardId)
    + delMeekoEventTax(game, player, cardId)
    - guardianOfTheWhillsDiscount(game, player, cardId)
    - forceChokeDiscount(game, player, cardId)
    - jabbaTheTrickDiscount(game, player, cardId)
    - benduDiscount(game, player, cardId)
    - gnkPowerDroidDiscount(game, player, cardId)
  ;
}

function canAfford(game: GameState, player: PlayerId, cardId: string): boolean {
  const ready = GetPlayer(game, player).resources.filter((r) => r.ready).length;
  return ready >= playCost(game, player, cardId);
}

function regionalGovernorBlocks(game: GameState, player: PlayerId, cardId: string): boolean {
  const title = CardTitle(cardId);
  if (!title) return false;
  const opp = GetOtherPlayer(player);
  const oppState = GetPlayer(game, opp);
  return [...oppState.groundArena, ...oppState.spaceArena].some(
    u => u.cardId === "SOR_062" && !Unit.FromInterface(u).LostAbilities() && u.namedCardTitle === title,
  );
}

/** Exhausts `count` ready resources. Never consults Credits — callers use payResources. */
function exhaustResourcesRaw(game: GameState, player: PlayerId, count: number): void {
  let remaining = count;
  for (const r of GetPlayer(game, player).resources) {
    if (remaining <= 0) break;
    if (r.ready) {
      r.ready = false;
      remaining--;
    }
  }
}

/**
 * Thrown by payResources when the player has a real choice about how many Credits
 * to defeat. runDispatch catches it, discards the speculative run, and prompts;
 * answering replays the dispatch with the decision recorded.
 */
class NeedsCreditDecision extends Error {
  constructor(
    readonly info: {
      paymentIndex: number;
      player: PlayerId;
      sourceCardId: string;
      fullCost: number;
      maxUseful: number;
      minForced: number;
    },
  ) {
    super("Credit payment decision required");
    this.name = "NeedsCreditDecision";
  }
}

/**
 * Per-dispatch Credit decision state, set by runDispatch before the handler runs.
 * creditDecisions[i] is how many Credits the player chose to defeat for the i-th
 * payment of this dispatch; a hole means "not decided yet".
 */
let creditDecisions: (number | null)[] = [];
let creditPaymentIndex = 0;

/**
 * The single entry point for paying a resource cost.
 *
 * CR 375: a Credit token reads "While paying resources, you may defeat this token.
 * If you do, pay 1 less" — so this applies to every cost in the game. Callers never
 * think about Credits: when the player has a real choice this unwinds with
 * NeedsCreditDecision, and the dispatch is replayed once the prompt is answered.
 */
function payResources(
  game: GameState,
  player: PlayerId,
  cost: number,
  log: string[],
  sourceCardId: string,
): void {
  const paymentIndex = creditPaymentIndex++;
  const p = GetPlayer(game, player);
  const credits = p.supplemental.creditTokens ?? 0;
  const ready = p.resources.filter(r => r.ready).length;
  const maxUseful = Math.min(credits, cost);
  const minForced = Math.max(0, cost - ready);

  const decided = creditDecisions[paymentIndex];
  let spend: number;
  if (typeof decided === "number") {
    spend = decided;
  } else if (maxUseful > minForced) {
    throw new NeedsCreditDecision({ paymentIndex, player, sourceCardId, fullCost: cost, maxUseful, minForced });
  } else {
    // No real choice: 0 when the player has no Credits, or the forced amount when
    // resources alone cannot cover the cost. Clamped to maxUseful because a caller's
    // affordability guard may be looser than this payment (deployLeader, for one,
    // counts all resources rather than ready ones) — never overdraw Credits.
    spend = Math.min(minForced, maxUseful);
  }

  if (spend > 0) {
    p.supplemental.creditTokens = credits - spend;
    log.push(`Player ${player} defeated ${spend} Credit token(s) to pay ${spend} less.`);
  }
  exhaustResourcesRaw(game, player, Math.max(0, cost - spend));
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
  if (arena === "Ground") GetPlayer(game, player).groundArena.push(unit);
  else GetPlayer(game, player).spaceArena.push(unit);
  return unit;
}

function removeFromArena(
  game: GameState,
  playId: string,
): { player: PlayerId; unit: Unit; zone: "groundArena" | "spaceArena" } | null {
  for (const player of [1, 2] as PlayerId[]) {
    const p = GetPlayer(game, player);
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
  GetPlayer(game, player).discard.unshift(discarded);
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
  GetPlayer(game, player).discard.unshift(discarded);
}

function dealBaseDamage(game: GameState, player: PlayerId, amount: number, byPlayer?: PlayerId): void {
  GetPlayer(game, player).base.damage += amount;
  if (byPlayer !== undefined) {
    game.roundState.baseDamagedThisPhase ??= [];
    game.roundState.baseDamagedThisPhase.push({ byPlayer, target: player });
  }
}

/**
 * Moves a unit to a new controller's arena, updating controller and removing from old arena.
 * Does not fire any triggers. Used for Take Control effects (Traitorous, Change of Heart).
 */
function transferControl(game: GameState, log: string[], unit: Unit, newController: PlayerId): void {
  const removed = removeFromArena(game, unit.playId);
  unit.controller = newController;
  const zone = removed?.zone ?? ((CardArena(unit.cardId) ?? "Ground") === "Ground" ? "groundArena" : "spaceArena");
  GetPlayer(game, newController)[zone].push(unit);
  log.push(`${CardTitle(unit.cardId)} is now controlled by Player ${newController}.`);
}

/**
 * Defeats the upgrade with the given playId, wherever it is attached, and resolves the
 * Traitorous control-reversion and Luke Skywalker pilot-eject interactions. Returns a
 * WhenDefeatedChoicePending when the defeated upgrade needs a follow-up choice (Luke eject),
 * otherwise null. `sourceLabel` prefixes the game-log entry (e.g. "Confiscate", "Ketsu Onyo").
 */
function defeatUpgradeByPlayId(
  game: GameState,
  log: string[],
  targetPlayId: string,
  sourceLabel: string,
  continuation: PendingResolution | null,
): PendingResolution | null {
  for (const u of GetAllUnits(game)) {
    const upgradeIdx = u.upgrades.findIndex(upg => upg.playId === targetPlayId);
    if (upgradeIdx === -1) continue;
    const [defeated] = u.upgrades.splice(upgradeIdx, 1);
    log.push(`${sourceLabel} defeated ${CardTitle(defeated.cardId)} on ${CardTitle(u.cardId)}.`);
    // Traitorous unattach: owner reclaims control when the upgrade is removed.
    if (defeated.cardId === "SOR_122" && u.controller !== u.owner) {
      transferControl(game, log, u, u.owner);
    }
    // Luke Skywalker eject: when defeated as a pilot upgrade, he may move to ground.
    if (defeated.cardId === "JTL_094") {
      return {
        type: "when-defeated-choice",
        defeatedCardId: "JTL_094",
        defeatedPlayId: defeated.playId,
        controlledBy: defeated.controller as PlayerId,
        options: [`move_to_ground_exhausted=JTL_094,${defeated.controller}`, "decline"],
        continuation,
      };
    }
    break;
  }
  return null;
}

/**
 * Moves an existing upgrade (by playId) off whatever unit it is currently on and attaches
 * it to the destination unit, transferring control of the upgrade to `abilityController`.
 * Handles Traitorous (SOR_122): the source unit reverts to its owner, and the destination
 * unit is taken over by the ability's controller. Used by Hondo Ohnaka's On Attack.
 */
function moveUpgradeToUnit(
  game: GameState,
  log: string[],
  upgradePlayId: string,
  destPlayId: string,
  abilityController: PlayerId,
): void {
  const dest = GetUnitByPlayId(game, destPlayId);
  for (const u of GetAllUnits(game)) {
    const idx = u.upgrades.findIndex(upg => upg.playId === upgradePlayId);
    if (idx === -1) continue;
    const [moved] = u.upgrades.splice(idx, 1);
    // Traitorous leaving the source unit: its owner reclaims control.
    if (moved.cardId === "SOR_122" && u.controller !== u.owner) {
      transferControl(game, log, u, u.owner as PlayerId);
    }
    if (!dest) return; // destination gone — the upgrade is simply removed
    moved.controller = abilityController;
    dest.upgrades.push(moved);
    log.push(`${CardTitle("JTL_056")}: moved ${CardTitle(moved.cardId)} onto ${CardTitle(dest.cardId)}.`);
    // Traitorous now on the destination: the ability's controller takes control of it.
    if (moved.cardId === "SOR_122" && dest.controller !== abilityController) {
      transferControl(game, log, dest, abilityController);
    }
    return;
  }
}

/**
 * Returns playIds of friendly Vehicle units that have zero pilot upgrades.
 * Used for L3-37's replacement effect — her card says "without a Pilot on it",
 * which means NO pilots at all (R2-D2 is a pilot via PilotingCost=0 and counts).
 */
function l337EligibleVehicles(game: GameState, player: PlayerId, l337PlayId: string): string[] {
  const p = GetPlayer(game, player);
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
 * Adds a unit to the arena from a deck-search "play" action — enters exhausted,
 * queues Shielded/Ambush/When-Played triggers into the bag for later drain.
 */
function addUnitFromSearch(game: GameState, log: string[], cardId: string, player: PlayerId, costModifier?: 'free' | number): void {
  let costDesc = 'for free';
  if (costModifier !== undefined && costModifier !== 'free') {
    const effectiveCost = Math.max(0, playCost(game, player, cardId) + costModifier);
    payResources(game, player, effectiveCost, log, cardId);
    costDesc = `for ${effectiveCost} resources`;
  }

  const unit = addToArena(game, player, cardId, false);
  log.push(`${CardTitle(cardId) ?? cardId} entered play ${costDesc}.`);
  game.roundState.cardsPlayedThisPhase.push({ fromPlayer: player, cardId, playId: unit.playId });
  game.roundState.cardsEnteredPlayThisPhase.push({ fromPlayer: player, cardId, playId: unit.playId, reason: "played" });
  const nested = game.triggerBag.length > 0;
  if (HasShielded(cardId, unit.playId, player)) {
    game.triggerBag.push({ triggerType: "shielded", cardId, fromPlayer: player, playId: unit.playId, nested });
  }
  if (HasAmbush(cardId, unit.playId, "Hand", player)) {
    game.triggerBag.push({ triggerType: "ambush", cardId, fromPlayer: player, playId: unit.playId, nested });
  }
  if (CardHasWhenPlayed(cardId)) {
    game.triggerBag.push({ triggerType: "when-played", cardId, fromPlayer: player, playId: unit.playId, nested });
  }
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
    case "ambush":              return `${name} — Ambush`;
    case "when-played":         return `${name} — When Played`;
    case "shielded":            return `${name} — Shielded`;
    case "leader-reaction":       return `${name} — Leader Ability`;
    case "enemy-unit-defeated":   return `${name} — When Enemy Defeated`;
    case "card-played-reaction":  return `${name} — Reaction`;
    default:                    return `${name} — ${t.triggerType}`;
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
    const unit = GetUnitByPlayId(game, trigger.playId);
    if (unit) {
      unit.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game), owner: trigger.fromPlayer, controller: trigger.fromPlayer });
      log.push(`Shielded: ${CardTitle(trigger.cardId)} enters play with a Shield token.`);
    }
    return null;
  }

  if (trigger.triggerType === "ambush" && trigger.playId) {
    const unit = GetUnitByPlayId(game, trigger.playId);
    if (!unit) return null;
    const { unitPlayIds } = computeAttackTargets(game, unit as Unit);
    if (unitPlayIds.length === 0) return null; // no valid unit targets — fizzle
    return {
      type: "ability-option",
      cardId: trigger.cardId,
      helperText: `${CardTitle(trigger.cardId)} has Ambush — attack immediately?`,
      yesLabel: "Attack",
      noLabel: "Skip",
      onYes: { type: "attack-target", attackerPlayId: trigger.playId, source: "ambush" },
      continuation: null,
    };
  }

  if (trigger.triggerType === "enemy-unit-defeated") {
    switch (trigger.cardId) {
      case "SOR_002": //Iden Versio - When an enemy unit is defeated: Heal 1 damage from your base.
        const base = trigger.fromPlayer === 1 ? game.player1.base : game.player2.base;
        base.damage = Math.max(0, base.damage - 1);
        return null;
      case "SOR_036": //Gideon Hask — When an enemy unit is defeated: Give an Experience token to a friendly unit.
        const friendlyUnits = GetUnitsForPlayer(trigger.fromPlayer);
        if (friendlyUnits.length === 0) return null;
        return {
          type: "ability-target",
          cardId: trigger.cardId,
          player: trigger.fromPlayer,
          fromPlayIds: friendlyUnits.map(u => u.playId),
          continuation: null,
        };
      default:
        return null;
    }
  }

  if (trigger.triggerType === "card-played-reaction") {
    switch (trigger.cardId) {
      case "SHD_172": { // Krayt Dragon: when an opponent plays a card, may deal damage = its cost to their base or a ground unit they control.
        const ctx = trigger.context as CardPlayedContext | undefined;
        const amount = ctx?.playedCardCost ?? 0;
        const opp = ctx?.cardPlayer;
        if (amount <= 0 || opp == null) return null; // 0-cost card → nothing worth dealing.
        const oppBaseId = `player${opp}.base`;
        const oppGround = GetPlayer(game, opp).groundArena.map(u => u.playId);
        return {
          type: "ability-option",
          cardId: "SHD_172",
          player: trigger.fromPlayer,
          helperText: `Deal ${amount} damage to their base or a ground unit they control?`,
          yesLabel: `Deal ${amount}`,
          noLabel: "Skip",
          onYes: {
            type: "ability-target",
            cardId: "SHD_172",
            player: trigger.fromPlayer,
            fromPlayIds: [oppBaseId, ...oppGround],
            amount,
            continuation: null,
          },
          continuation: null,
        } satisfies AbilityOptionPending;
      }
      case "SHD_014": { // Cad Bane — When you play an Underworld card: may (front: exhaust leader;) opponent chooses one of their units, deal 1 (front) / 2 (deployed) to it.
        const leaderC = GetLeaderForPlayer(trigger.fromPlayer);
        const oppC = GetOtherPlayer(trigger.fromPlayer);
        if (GetUnitsForPlayer(oppC).length === 0) return null; // opponent has no unit to choose
        return {
          type: "ability-option",
          cardId: "SHD_014",
          player: trigger.fromPlayer,
          helperText: leaderC.deployed
            ? "An opponent chooses a unit they control to take 2 damage?"
            : "Exhaust Cad Bane — an opponent chooses a unit they control to take 1 damage?",
          yesLabel: leaderC.deployed ? "Deal 2" : "Exhaust",
          noLabel: "Skip",
          onYes: null,
          continuation: null,
        } satisfies AbilityOptionPending;
      }
      case "TWI_018": { // Quinlan Vos — When you play a unit: may deal 1 to an enemy unit of equal cost (front, + exhaust leader) / same-or-less cost (deployed).
        const ctxQ = trigger.context as CardPlayedContext | undefined;
        const costQ = ctxQ?.playedCardCost ?? 0;
        const leaderQ = GetLeaderForPlayer(trigger.fromPlayer);
        const oppQ = GetOtherPlayer(trigger.fromPlayer);
        const eligibleQ = GetUnitsForPlayer(oppQ).filter(u =>
          leaderQ.deployed ? (CardCost(u.cardId) ?? 0) <= costQ : (CardCost(u.cardId) ?? 0) === costQ);
        if (eligibleQ.length === 0) return null;
        return {
          type: "ability-option",
          cardId: "TWI_018",
          player: trigger.fromPlayer,
          amount: costQ,
          helperText: leaderQ.deployed
            ? "Deal 1 damage to an enemy unit that costs the same as or less than the played unit?"
            : "Exhaust Quinlan Vos to deal 1 damage to an enemy unit of equal cost?",
          yesLabel: "Deal 1",
          noLabel: "Skip",
          onYes: null,
          continuation: null,
        } satisfies AbilityOptionPending;
      }
      case "SHD_018": { // The Mandalorian — When you play an upgrade: may exhaust an enemy unit (front ≤4 HP + exhaust leader; deployed ≤6 HP).
        const leader018 = GetLeaderForPlayer(trigger.fromPlayer);
        const threshold018 = leader018.deployed ? 6 : 4;
        const opp018 = GetOtherPlayer(trigger.fromPlayer);
        const eligible018 = GetUnitsForPlayer(opp018).filter(u => u.CurrentHP() <= threshold018);
        if (eligible018.length === 0) return null;
        return {
          type: "ability-option",
          cardId: "SHD_018",
          player: trigger.fromPlayer,
          helperText: leader018.deployed
            ? "Exhaust an enemy unit with 6 or less remaining HP?"
            : "Exhaust The Mandalorian to exhaust an enemy unit with 4 or less remaining HP?",
          yesLabel: leader018.deployed ? "Exhaust unit" : "Exhaust",
          noLabel: "Skip",
          onYes: null,
          continuation: null,
        } satisfies AbilityOptionPending;
      }
      case "SOR_143": { // Fighters for Freedom: may deal 1 damage to a base
        return {
          type: "ability-option",
          cardId: "SOR_143",
          player: trigger.fromPlayer,
          helperText: "Deal 1 damage to a base?",
          yesLabel: "Deal 1",
          noLabel: "Skip",
          onYes: {
            type: "ability-target",
            cardId: "SOR_143",
            player: trigger.fromPlayer,
            fromPlayIds: ["player1.base", "player2.base"],
            continuation: null,
          },
          continuation: null,
        } satisfies AbilityOptionPending;
      }
    }
    return null;
  }

  if (trigger.triggerType === "leader-reaction") {
    const leaderState = GetPlayer(game, trigger.fromPlayer).leader;
    if (leaderState.deployed || !leaderState.ready) return null;
    switch (trigger.cardId) {
      case "SHD_008": {
        const friendlyPlayIds = GetUnitsForPlayer(trigger.fromPlayer).map(u => u.playId);
        if (friendlyPlayIds.length === 0) return null;
        return {
          type: "ability-option",
          cardId: "SHD_008",
          helperText: "Exhaust Boba Fett — give a friendly unit +1/+0 for this phase?",
          yesLabel: "Exhaust",
          noLabel: "Skip",
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
  // Skip nested triggers here — they'll be prioritized by the nested-first block below.
  for (let i = 0; i < game.triggerBag.length; ) {
    const t = game.triggerBag[i];
    if (t.triggerType !== "when-defeated" || t.nested) { i++; continue; }
    game.triggerBag.splice(i, 1);
    const wdCtx = t.context as { defeatedUnit?: UnitInterface } | undefined;
    if (!wdCtx?.defeatedUnit) continue;
    const unit = Unit.FromInterface(wdCtx.defeatedUnit);
    const wdPending = resolveWhenDefeated(unit, t.fromPlayer);
    if (wdPending) return wdPending;
  }

  if (game.triggerBag.length === 0) {
    game.triggerBatchPlayer = undefined;
    return null;
  }

  // CR 7.6.11-12: nested triggers (arose during resolution of another trigger) must resolve
  // before outer sibling triggers. Auto-prioritize them without offering an ordering choice.
  const nestedTriggers = game.triggerBag.filter(t => t.nested);
  const hasOuter = game.triggerBag.some(t => !t.nested);
  if (nestedTriggers.length > 0 && hasOuter) {
    if (nestedTriggers.length === 1) {
      game.triggerBag.splice(game.triggerBag.indexOf(nestedTriggers[0]), 1);
      return processSingleTrigger(nestedTriggers[0], game, log);
    }
    return {
      type: "trigger-order",
      triggers: nestedTriggers.map(t => ({
        label: triggerLabel(t),
        triggerType: t.triggerType,
        cardId: t.cardId,
        playId: t.playId,
        fromPlayer: t.fromPlayer,
      })),
    } satisfies TriggerOrderPending;
  }

  // Ordering-irrelevant fast path: when EVERY waiting trigger (across both players) shares the
  // same cardId + triggerType, the result is order-independent — auto-drain without any prompt
  // (e.g. a board wipe where both players' Iden/Gideon fire once per simultaneous death).
  const globalSameSource =
    game.triggerBag.length >= 2 &&
    game.triggerBag.every(
      t => t.cardId === game.triggerBag[0].cardId && t.triggerType === game.triggerBag[0].triggerType,
    );
  if (globalSameSource) {
    while (game.triggerBag.length > 0) {
      const [trigger] = game.triggerBag.splice(0, 1);
      const pending = processSingleTrigger(trigger, game, log);
      if (pending !== null) return pending;
    }
    game.triggerBatchPlayer = undefined;
    return null;
  }

  // CR 7.6.10: when triggers from BOTH players wait simultaneously, the active player first
  // chooses which player resolves their whole stack first. The choice is remembered in
  // game.triggerBatchPlayer across the resolution chain, so the other player's triggers are
  // deferred until the chosen player's stack is exhausted (no re-prompt).
  let batchPlayer = game.triggerBatchPlayer;
  if (batchPlayer != null && !game.triggerBag.some(t => t.fromPlayer === batchPlayer)) {
    batchPlayer = game.triggerBatchPlayer = undefined; // that player's stack is done
  }
  const playersWithTriggers = new Set(game.triggerBag.map(t => t.fromPlayer));
  if (batchPlayer == null && playersWithTriggers.size >= 2) {
    return { type: "trigger-player-order", activePlayer: game.activePlayer } satisfies TriggerPlayerOrderPending;
  }

  // Resolve within a single player's stack — the chosen batch player, or (when only one player
  // has triggers) that player. CR 7.6.9: that player orders their own triggers.
  const targetPlayer = batchPlayer ?? game.triggerBag[0].fromPlayer;
  const myTriggers = game.triggerBag.filter(t => t.fromPlayer === targetPlayer);

  // Auto-drain when all of this player's triggers share cardId + triggerType (e.g. a board wipe
  // where Iden/Gideon fires N times for N simultaneous deaths — ordering is irrelevant).
  const allSameSource =
    myTriggers.length >= 2 &&
    myTriggers.every(t => t.cardId === myTriggers[0].cardId && t.triggerType === myTriggers[0].triggerType);

  if (myTriggers.length >= 2 && !allSameSource) {
    return {
      type: "trigger-order",
      triggers: myTriggers.map(t => ({
        label: triggerLabel(t),
        triggerType: t.triggerType,
        cardId: t.cardId,
        playId: t.playId,
        fromPlayer: t.fromPlayer,
      })),
    } satisfies TriggerOrderPending;
  }

  // Single trigger or all-same-source: process this player's triggers in order, auto-draining
  // nulls, stopping at the first interactive one.
  while (true) {
    const idx = game.triggerBag.findIndex(t => t.fromPlayer === targetPlayer);
    if (idx === -1) break;
    const [trigger] = game.triggerBag.splice(idx, 1);
    const pending = processSingleTrigger(trigger, game, log);
    if (pending !== null) return pending;
  }

  // This player's stack is exhausted — clear the marker and continue with the other player.
  game.triggerBatchPlayer = undefined;
  return drainTriggerBag(game, log);
}

/**
 * Drain on-attack triggers from the bag after the attack target is locked in.
 * Returns a PendingResolution if the trigger requires player input (with
 * combat queued as continuation), or null if no on-attack triggers are present.
 */

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
        type: "ability-option",
        cardId: "JTL_049",
        sourcePlayId: unit.playId,
        helperText: "Attach L3-37 as an upgrade to a friendly Vehicle without a Pilot instead of being defeated?",
        yesLabel: "Move Brain to Vehicle",
        noLabel: "Defeat",
        onYes: null,
        continuation: null,
      };
    }
  }

  const removed = removeFromArena(game, unit.playId);
  if (!removed) return null;

  if (CardIsLeader(unit.cardId)) {
    const leader = GetPlayer(game, removed.player).leader;
    leader.deployed = false;
    leader.ready = false;
    leader.deployedPlayId = undefined;
    log.push(
      `${CardTitle(unit.cardId)} was defeated and returned to the leader zone.`,
    );
    return null;
  }

  // Tokens are set aside on defeat, not placed in discard (CR 7.6.1).
  // A defeated card goes to its OWNER's discard, not its controller's — this differs
  // for units taken with a control effect (No Glory Only Results, Traitorous, …).
  if (!unit.IsTokenUnit()) {
    pushToDiscard(game, unit.owner, unit);
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
    if (arena === "Ground") GetPlayer(game, captive.owner).groundArena.push(rescued);
    else GetPlayer(game, captive.owner).spaceArena.push(rescued);
    game.roundState.cardsEnteredPlayThisPhase.push({
      fromPlayer: captive.owner,
      cardId: captive.cardId,
      playId: captive.playId,
      reason: "returned-to-play",
    });
    log.push(`${CardTitle(captive.cardId)} was rescued and returned to Player ${captive.owner}'s arena exhausted.`);
  }

  // When an enemy unit is defeated
  const otherPlayer: PlayerId = removed.player === 1 ? 2 : 1;
  for (const unit of GetUnitsForPlayer(otherPlayer)) {
    switch (unit.cardId) {
      case "SOR_002": //Iden Versio
      case "SOR_036": //Gideon Hask
      case "LOF_130": //HK-47
      case "SEC_051": //Bo-Katan Kryze
      case "ASH_052": //Chimaera
      {
        game.triggerBag.push({
          triggerType: "enemy-unit-defeated",
          cardId: unit.cardId,
          fromPlayer: otherPlayer,
          playId: unit.playId,
        });
        break;
      }
    }
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
    const leader = GetPlayer(game, removed.player).leader;
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
    if (arena === "Ground") GetPlayer(game, captive.owner).groundArena.push(rescued);
    else GetPlayer(game, captive.owner).spaceArena.push(rescued);
    game.roundState.cardsEnteredPlayThisPhase.push({
      fromPlayer: captive.owner,
      cardId: captive.cardId,
      playId: captive.playId,
      reason: "returned-to-play",
    });
    log.push(`${CardTitle(captive.cardId)} was rescued from Exploit-defeated unit.`);
  }

  // Gideon Hask (SOR_036): react to exploit-defeated enemy unit.
  const gideonPlayerE: PlayerId = removed.player === 1 ? 2 : 1;
  const gideonUnitE = GetPlayer(game, gideonPlayerE).groundArena.find(u => u.cardId === "SOR_036");
  if (gideonUnitE) {
    game.triggerBag.push({ triggerType: "enemy-unit-defeated", cardId: "SOR_036", fromPlayer: gideonPlayerE, playId: gideonUnitE.playId, nested: true });
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

/**
 * Defeats a list of units as part of a board-wipe effect (CR simultaneous defeat).
 * Uses pre-snapshotted trigger-holder arrays so both players' Iden/Gideon triggers
 * fire correctly even though those units are themselves being wiped.
 */
function boardWipeDefeat(
  game: GameState,
  log: string[],
  unitsToDefeat: Unit[],
  holdersP1: Unit[],
  holdersP2: Unit[],
): void {
  const ENEMY_DEF_CARDS = ["SOR_002", "SOR_036", "LOF_130", "SEC_051", "ASH_052"];
  for (const unit of unitsToDefeat) {
    const removed = removeFromArena(game, unit.playId);
    if (!removed) continue;

    // Fire enemy-unit-defeated triggers for ALL unit types (including leaders) using
    // the pre-wipe snapshot, so units that are themselves being wiped still trigger.
    const otherPlayer: PlayerId = removed.player === 1 ? 2 : 1;
    for (const holder of (otherPlayer === 1 ? holdersP1 : holdersP2)) {
      if (ENEMY_DEF_CARDS.includes(holder.cardId)) {
        game.triggerBag.push({
          triggerType: "enemy-unit-defeated",
          cardId: holder.cardId,
          fromPlayer: otherPlayer,
          playId: holder.playId,
        });
      }
    }

    if (CardIsLeader(unit.cardId)) {
      const leader = GetPlayer(game, removed.player).leader;
      leader.deployed = false;
      leader.ready = false;
      leader.deployedPlayId = undefined;
      log.push(`${CardTitle(unit.cardId)} was defeated and returned to the leader zone.`);
      continue; // leaders have no when-defeated effect and go to leader zone, not discard
    }

    if (!unit.IsTokenUnit()) pushToDiscard(game, removed.player, unit);
    game.roundState.cardsLeftPlayThisPhase.push({
      fromPlayer: removed.player,
      cardId: unit.cardId,
      playId: unit.playId,
      reason: unit.IsTokenUnit() ? "token-defeated" : "defeated",
    });

    for (const captive of unit.captives ?? []) {
      const arena = (CardArena(captive.cardId) ?? "Ground") as "Ground" | "Space";
      const rescued = Unit.FromInterface({ ...captive, ready: false });
      if (arena === "Ground") GetPlayer(game, captive.owner).groundArena.push(rescued);
      else GetPlayer(game, captive.owner).spaceArena.push(rescued);
      game.roundState.cardsEnteredPlayThisPhase.push({
        fromPlayer: captive.owner,
        cardId: captive.cardId,
        playId: captive.playId,
        reason: "returned-to-play",
      });
      log.push(`${CardTitle(captive.cardId)} was rescued.`);
    }

    log.push(`${CardTitle(unit.cardId)} was defeated.`);

    game.triggerBag.push({
      triggerType: "when-defeated",
      cardId: unit.cardId,
      fromPlayer: removed.player,
      playId: unit.playId,
      context: { defeatedUnit: unit },
    });
  }
}

function computeAttackTargets(
  game: GameState,
  attacker: Unit
): { unitPlayIds: string[]; includesBase: boolean } {
  const inGround =
    game.player1.groundArena.some(u => u.playId === attacker.playId) ||
    game.player2.groundArena.some(u => u.playId === attacker.playId);
  const arena = inGround ? "Ground" : "Space";
  const defenderPlayer = GetOtherPlayer(attacker.controller);
  const p = GetPlayer(game, defenderPlayer);
  const opposing = (arena === "Ground" ? p.groundArena : p.spaceArena) as Unit[];

  // Hidden: exclude units played/deployed/created this phase. Rescued units (returned-to-play)
  // do not regain Hidden protection — only the original play/deploy/create triggers it.
  const enteredThisPhase = new Set(
    game.roundState.cardsEnteredPlayThisPhase
      .filter(e => e.reason !== "returned-to-play")
      .map(e => e.playId)
  );
  const visible = opposing.filter(u => {
    if (HasHidden(u.cardId, u.playId, u.controller) && enteredThisPhase.has(u.playId) && !HasSentinel(u.cardId, u.playId, u.controller)) return false;
    // Explosives Artist (SOR_142): can't be attacked if ≥3 distinct aspects among other friendlies (unless Sentinel).
    if (u.cardId === "SOR_142" && !HasSentinel(u.cardId, u.playId, u.controller) && !Unit.FromInterface(u).LostAbilities()) {
      const otherFriendlyAspects = new Set(
        [...GetPlayer(game, u.controller).groundArena, ...GetPlayer(game, u.controller).spaceArena]
          .filter(f => f.playId !== u.playId)
          .flatMap(f => CardAspects(f.cardId))
      );
      if (otherFriendlyAspects.size >= 3) return false;
    }
    return true;
  });

  // Strafing Gunship (SOR_212): space unit that can also attack enemy ground units.
  // Combine space + ground visible targets, then apply sentinel check over the combined pool.
  let finalVisible = visible;
  if (attacker.cardId === "SOR_212" && arena === "Space" && !Unit.FromInterface(attacker).LostAbilities()) {
    const enemyGround212 = p.groundArena as Unit[];
    const visibleGround212 = enemyGround212.filter(u => {
      if (HasHidden(u.cardId, u.playId, u.controller) && enteredThisPhase.has(u.playId) && !HasSentinel(u.cardId, u.playId, u.controller)) return false;
      return true;
    });
    finalVisible = [...visible, ...visibleGround212];
  }

  const sentinels = finalVisible.filter((u) => {
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
  // Fly Casual (JTL_206): readied Vehicle can't attack bases for the phase.
  const cantAttackBase = game.currentEffects.some(
    e => e.cardId === "JTL_206_no_base" && e.targetPlayId === attacker.playId,
  );
  return { unitPlayIds: finalVisible.map((u) => u.playId), includesBase: !entrenchedUnit && !cantAttackBase };
}

// ---------------------------------------------------------------------------
// Helpers: resolve combat
// ---------------------------------------------------------------------------

// The eight common LOF "Force" bases, all sharing the passive:
//   "When a friendly Force unit attacks: The Force is with you (create your Force token)."
const FORCE_ON_ATTACK_BASES = new Set([
  "LOF_020", "LOF_021", "LOF_023", "LOF_024",
  "LOF_026", "LOF_027", "LOF_029", "LOF_030",
]);

function resolveAttack(
  game: GameState,
  log: string[],
  pending: AttackTargetPending,
  target:
    | { type: "unit"; playId: string }
    | { type: "base"; player: PlayerId },
): PendingResolution | null {
  const attacker = GetUnitByPlayId(game, pending.attackerPlayId);
  if (!attacker) return null;

  // Common "Force" bases: "When a friendly Force unit attacks: The Force is with you
  // (create your Force token)." Passive, mandatory, and targetless, so it fires inline
  // here at attack declaration (before combat damage) on every attack path — normal,
  // Ambush, and ability-initiated — and re-triggers each attack.
  const controllerBaseId = GetPlayer(game, attacker.controller).base.cardId;
  if (
    FORCE_ON_ATTACK_BASES.has(controllerBaseId) &&
    TraitContains(attacker.cardId, "Force", attacker.controller, attacker.playId)
  ) {
    CreateForceToken(attacker.controller, log, controllerBaseId);
  }

  // Restore fires as an On Attack trigger before combat damage
  const restoreAmount = RestoreAmount(attacker.cardId, attacker.playId, attacker.controller);
  if (restoreAmount > 0) {
    const controllerBase = GetPlayer(game, attacker.controller).base;
    controllerBase.damage = Math.max(0, controllerBase.damage - restoreAmount);
    log.push(`Restore ${restoreAmount}: healed ${restoreAmount} damage from Player ${attacker.controller}'s base.`);
  }

  attacker.ready = false;
  game.roundState.unitsAttackedThisPhase.push({
    fromPlayer: attacker.controller,
    cardId: attacker.cardId,
    playId: attacker.playId,
  });
  const atkPower = attacker.CurrentPower(true);
  const attackerName = CardTitle(attacker.cardId);

  if (target.type === "base") {
    dealBaseDamage(game, target.player, atkPower, attacker.controller);
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
    // SHD_147 Ketsu Onyo: when deals combat damage to a base, may defeat an upgrade that costs 2 or less.
    if (attacker.cardId === "SHD_147" && !Unit.FromInterface(attacker).LostAbilities() && atkPower > 0) {
      const eligibleUpgrades147 = GetAllUnits(game)
        .flatMap(u => u.upgrades)
        .filter(up => CardCost(up.cardId) <= 2);
      if (eligibleUpgrades147.length > 0) {
        return {
          type: "ability-option" as const,
          cardId: "SHD_147",
          player: attacker.controller,
          helperText: "Defeat an upgrade that costs 2 or less?",
          yesLabel: "Defeat",
          noLabel: "Skip",
          onYes: {
            type: "ability-target" as const,
            cardId: "SHD_147_defeat_upgrade",
            player: attacker.controller,
            fromPlayIds: eligibleUpgrades147.map(up => up.playId),
            continuation: whenAttackEnds,
          },
          continuation: whenAttackEnds,
        } satisfies AbilityOptionPending;
      }
    }
    // SOR_133 Seventh Sister: when deals combat damage to opponent's base, may deal 3 to a ground unit.
    if (attacker.cardId === "SOR_133" && !Unit.FromInterface(attacker).LostAbilities()) {
      const defenderState = target.player === 1 ? game.player1 : game.player2;
      const enemyGround133 = defenderState.groundArena as Unit[];
      if (enemyGround133.length > 0) {
        return {
          type: "ability-option" as const,
          cardId: "SOR_133",
          player: attacker.controller,
          helperText: "Deal 3 damage to a ground unit that opponent controls?",
          yesLabel: "Deal 3",
          noLabel: "Skip",
          onYes: {
            type: "ability-target" as const,
            cardId: "SOR_133",
            player: attacker.controller,
            fromPlayIds: enemyGround133.map(u => u.playId),
            continuation: whenAttackEnds,
          },
          continuation: whenAttackEnds,
        } satisfies AbilityOptionPending;
      }
    }
    return whenAttackEnds;
  } else {
    const defender = GetUnitByPlayId(game, target.playId);
    if (!defender) return null;

    // Strafing Gunship (SOR_212): defender gets –2/+0 when attacking a ground unit from space.
    const defenderIsGround212 =
      attacker.cardId === "SOR_212" &&
      !Unit.FromInterface(attacker).LostAbilities() &&
      (game.player1.groundArena.some(u => u.playId === defender.playId) ||
       game.player2.groundArena.some(u => u.playId === defender.playId));
    const defPower = Math.max(0, defender.CurrentPower() - (defenderIsGround212 ? 2 : 0));

    // SOR_071 Electrostaff: while attached unit is defending, attacker gets –1/–0.
    const electrostaffModifier = defender.upgrades.some(u => u.cardId === "SOR_071") ? 1 : 0;
    const effectiveAtkPower = Math.max(0, atkPower - electrostaffModifier);
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

    // First strike (SOR_217): attacker deals damage first; if defender is defeated, no counter-damage.
    const hasFirstStrike = game.currentEffects.some(
      e => e.cardId === "SOR_217_first_strike" && e.targetPlayId === attacker.playId && e.duration === "ForAttack",
    );

    // Shield token absorbs the first instance of damage to the defender.
    const shieldIdx = defender.upgrades.findIndex(u => u.cardId === "SOR_T02");
    if (shieldIdx !== -1) {
      defender.upgrades.splice(shieldIdx, 1);
      log.push(`${defenderName}'s Shield token was defeated, preventing ${effectiveAtkPower} damage.`);
    } else {
      defender.damage += effectiveAtkPower;
    }

    // If first strike is active and defender is now defeated, counter-damage is 0.
    const effectiveDefPower = hasFirstStrike && defender.CurrentHP() <= 0 ? 0 : defPower;
    if (hasFirstStrike && effectiveDefPower === 0 && defender.CurrentHP() <= 0) {
      log.push(`Shoot First: ${defenderName} defeated before dealing counter-damage.`);
    }

    // Shield token absorbs the first instance of counter-damage to the attacker.
    const attackerShieldIdx = attacker.upgrades.findIndex(u => u.cardId === "SOR_T02");
    if (effectiveDefPower === 0) {
      // No counter-damage — shield is not consumed
    } else if (attackerShieldIdx !== -1) {
      attacker.upgrades.splice(attackerShieldIdx, 1);
      log.push(`${attackerName}'s Shield token was defeated, preventing ${effectiveDefPower} counter-damage.`);
    } else {
      attacker.damage += effectiveDefPower;
    }
    log.push(`${attackerName} attacked ${defenderName}.`);

    // A Shield token absorbs the entire damage instance, so no combat damage
    // reaches the defender and there is no excess for Overwhelm to spill.
    const excessDamage = shieldIdx === -1 ? Math.max(effectiveAtkPower - defHpBefore, 0) : 0;

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
        if (excessDamage > 0) {
          dealBaseDamage(game, GetOtherPlayer(attacker.controller), excessDamage);
          log.push(`Overwhelm: ${excessDamage} excess damage dealt to the base.`);
        }
      }
    } catch {
      // HasOverwhelm may throw if unit isn't in singleton; ignore safely
    }

    // SOR_085 Rukh: when deals combat damage to a non-leader unit, defeat that unit.
    const rukhDefeat =
      attacker.cardId === "SOR_085" &&
      !Unit.FromInterface(attacker).LostAbilities() &&
      effectiveAtkPower > 0 &&
      shieldIdx === -1 && // shield didn't absorb (combat damage was actually dealt)
      !CardIsLeader(defender.cardId);

    const defDefeated = defender.CurrentHP() <= 0 || rukhDefeat;
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
      const whenAttackEnds = resolveWhenAttackEnds(game, attacker, pending.continuation ?? null, defDefeated, excessDamage);
      type WithContinuation = { continuation: PendingResolution | null | undefined };
      let tail: WithContinuation = nextPending as unknown as WithContinuation;
      while (tail.continuation != null) tail = tail.continuation as unknown as WithContinuation;
      tail.continuation = whenAttackEnds;
      return nextPending;
    }

    return resolveWhenAttackEnds(game, attacker, pending.continuation ?? null, defDefeated, excessDamage);
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
  defDefeated: boolean = false,
  excessDamage: number = 0,
): PendingResolution | null {
  // Darth Revan (LOF_017) — controller-level reaction to ANY friendly unit attacking and
  // defeating a unit. It resolves before the attacker's own When-Attack-Ends ability.
  // Front side: "you may exhaust this leader" is the cost (so only offer when ready);
  // deployed side: no exhaust cost.
  if (defDefeated && GetUnitByPlayId(game, attacker.playId)) {
    const leader = GetLeaderForPlayer(attacker.controller);
    if (leader.cardId === "LOF_017" && (leader.deployed || leader.ready)) {
      const rest = attackerOwnWhenAttackEnds(game, attacker, continuation, defDefeated, excessDamage);
      return {
        type: "ability-option",
        cardId: "LOF_017",
        player: attacker.controller,
        sourcePlayId: attacker.playId,
        helperText: leader.deployed
          ? `Give an Experience token to ${CardTitle(attacker.cardId)}?`
          : `Exhaust ${CardTitle("LOF_017")} to give an Experience token to ${CardTitle(attacker.cardId)}?`,
        yesLabel: leader.deployed ? "Give XP" : "Exhaust",
        noLabel: "Skip",
        onYes: null,
        continuation: rest,
      };
    }
  }
  return attackerOwnWhenAttackEnds(game, attacker, continuation, defDefeated, excessDamage);
}

function attackerOwnWhenAttackEnds(
  game: GameState,
  attacker: Unit,
  continuation: PendingResolution | null,
  defDefeated: boolean = false,
  excessDamage: number = 0,
): PendingResolution | null {
  // If attacker was defeated, no trigger fires
  if (!GetUnitByPlayId(game, attacker.playId)) return continuation;

  // Upgrade-granted When-Attack-Ends abilities
  for (const upgrade of attacker.upgrades) {
    switch (upgrade.cardId) {
      case "ASH_229": { // Camtono — When Attack Ends: look at top card; if it costs 2 or less, you may play it for free.
        const pState229 = GetPlayer(game, attacker.controller);
        if (pState229.deck.length === 0) break;
        const top229 = pState229.deck[pState229.deck.length - 1];
        if ((CardCost(top229.cardId) ?? 99) > 2) break;
        return {
          type: "ability-option",
          cardId: "ASH_229",
          player: attacker.controller,
          helperText: `Play ${CardTitle(top229.cardId)} for free?`,
          yesLabel: "Play Free",
          noLabel: "Skip",
          onYes: null,
          continuation,
        };
      }
      default: break;
    }
  }

  switch (attacker.cardId) {
    case "SOR_149": { // Mace Windu — when attacks and defeats a unit: Ready him.
      if (defDefeated && !Unit.FromInterface(attacker).LostAbilities()) {
        attacker.ready = true;
      }
      return continuation;
    }
    case "SOR_146": { // Zeb Orrelios — when completes attack and defeats defender: may deal 4 to a ground unit
      if (!defDefeated) return continuation;
      const allGround146 = AllGroundUnits();
      if (allGround146.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        player: attacker.controller,
        helperText: "Deal 4 damage to a ground unit?",
        yesLabel: "Deal 4",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: attacker.cardId,
          player: attacker.controller,
          fromPlayIds: allGround146.map(u => u.playId),
          continuation,
        },
        continuation,
      };
    }
    case "SOR_088": { // Blizzard Assault AT-AT — when attacks and defeats: deal excess to an enemy ground unit
      if (!defDefeated || excessDamage === 0) return continuation;
      const enemyGround088 = AllGroundUnits().filter(u => u.controller !== attacker.controller);
      if (enemyGround088.length === 0) return continuation;
      game.currentEffects.push({ cardId: "SOR_088_excess", duration: "Phase", affectedPlayer: attacker.controller, value: excessDamage });
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        helperText: `Deal ${excessDamage} excess damage to an enemy ground unit?`,
        yesLabel: `Deal ${excessDamage}`,
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: attacker.cardId,
          player: attacker.controller,
          fromPlayIds: enemyGround088.map(u => u.playId),
          continuation,
        },
        continuation,
      };
    }
    case "SOR_192": { // Ezra Bridger — when completes attack: look at top card, play/discard/leave
      const deck192 = attacker.controller === 1 ? game.player1.deck : game.player2.deck;
      if (deck192.length === 0) return continuation;
      const topCard192 = deck192[deck192.length - 1];
      const cost192 = playCost(game, attacker.controller, topCard192.cardId);
      const ready192 = spendableFor(game, attacker.controller);
      const discardStep192 = {
        type: "ability-option" as const,
        cardId: "SOR_192_discard",
        player: attacker.controller,
        helperText: `Discard ${CardTitle(topCard192.cardId)}? (No = leave on top)`,
        yesLabel: "Discard",
        noLabel: "Leave on Top",
        onYes: null,
        continuation,
      };
      if (ready192 < cost192) return discardStep192;
      return {
        type: "ability-option",
        cardId: "SOR_192",
        player: attacker.controller,
        helperText: `Play ${CardTitle(topCard192.cardId)} for ${cost192} resource(s)?`,
        yesLabel: "Play",
        noLabel: "Skip",
        onYes: null,
        continuation: discardStep192,
      };
    }
    case "SOR_009": { // Leia Organa: You may attack with another Rebel unit
      const rebelUnits = (GetUnitsForPlayer(attacker.controller) as Unit[])
        .filter(u => u.ready && TraitContains(u.cardId, "Rebel", attacker.controller, u.playId));
      if (rebelUnits.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: "SOR_009",
        helperText: "Attack with another Rebel unit?",
        yesLabel: "Attack",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "SOR_009",
          fromPlayIds: rebelUnits.map(u => u.playId),
          continuation,
        },
        continuation,
      };
    }
    case "SEC_006": { // Colonel Yularen (deployed): You may attack with another unit that costs 4 or less.
      const eligible006 = (GetUnitsForPlayer(attacker.controller) as Unit[])
        .filter(u => u.ready && u.playId !== attacker.playId && CardCost(u.cardId) <= 4);
      if (eligible006.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: "SEC_006_back",
        player: attacker.controller,
        helperText: "Attack with another unit that costs 4 or less?",
        yesLabel: "Attack",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "SEC_006_back",
          player: attacker.controller,
          fromPlayIds: eligible006.map(u => u.playId),
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
  return { dispatchResponseId: randomUUID(), newGameState: game, sentinelPlayIds: computeSentinelPlayIds(game), unitBuffs: computeUnitBuffs(game) };
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
      const attacker = GetUnitByPlayId(game, pending.attackerPlayId);
      if (!attacker) return { type: "Target" } satisfies NeedsTarget;
      const { unitPlayIds, includesBase } = computeAttackTargets(game, attacker);
      const allowBase = includesBase && pending.source !== "ambush" && pending.source !== "SOR_110";
      return {
        type: "Target",
        fromPlayIds: unitPlayIds.length > 0 ? unitPlayIds : undefined,
        fromZones: allowBase ? ["Base"] : undefined,
      } satisfies NeedsTarget;
    }
    case "ability-option":
      return { type: "Option", helperText: pending.helperText, options: ["Yes", "No"], yesLabel: pending.yesLabel, noLabel: pending.noLabel } satisfies NeedsOption;
    case "ability-target":
      return {
        type: "Target",
        fromPlayIds: pending.fromPlayIds.length > 0 ? pending.fromPlayIds : undefined,
        fromChoices: pending.fromChoices && pending.fromChoices.length > 0 ? pending.fromChoices : undefined,
        ...(pending.fromZones && pending.fromZones.length > 0 && { fromZones: pending.fromZones }),
        ...(pending.needsMultiple && { needsMultiple: true }),
        ...(pending.maxTargets !== undefined && { maxTargets: pending.maxTargets }),
      } satisfies NeedsTarget;
    case "when-defeated-choice":
      return {
        type: "Option",
        helperText: `Choose When Defeated effect for ${CardTitle(pending.defeatedCardId)}.`,
        options: pending.options,
      } satisfies NeedsOption;
    case "choose-one":
      return {
        type: "Option",
        helperText: `${CardTitle(pending.cardId)} — choose one:`,
        options: pending.options.map(o => o.id),
        optionLabels: pending.options.map(o => o.label),
      } satisfies NeedsOption;
    case "discard-from-hand":
      return { type: "Target", fromZones: ["Hand"], handOwner: pending.targetPlayer } satisfies NeedsTarget;
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
    case "bounty":
      return {
        type: "Option",
        helperText: `Collect bounty (${CardTitle(pending.cardId)})?`,
        options: ["Yes", "No"],
      } satisfies NeedsOption;
    case "resolve-attack":
      // Should never be shown to client — auto-resolves as continuation
      return { type: "Target" } satisfies NeedsTarget;
    case "exploit-option":
      return {
        type: "Option",
        helperText: `Use Exploit ${pending.exploitAmount} while playing ${CardTitle(pending.cardId)}?`,
        options: ["Yes", "No"],
      } satisfies NeedsOption;
    case "credit-payment-option": {
      // Only one amount above the forced floor → the Yes/No prompt is the whole flow.
      const onlyOneAmount = pending.maxUseful === pending.minForced + 1;
      return {
        type: "Option",
        helperText: onlyOneAmount
          ? `Use ${pending.maxUseful} Credit(s) to pay less for ${CardTitle(pending.cardId)}?`
          : `Use Credits to pay less for ${CardTitle(pending.cardId)}?`,
        options: ["Yes", "No"],
        yesLabel: onlyOneAmount ? `Use ${pending.maxUseful} Credit(s)` : "Use Credits",
        noLabel: pending.minForced > 0
          ? `Use only ${pending.minForced} Credit(s)`
          : `Pay ${pending.fullCost}`,
      } satisfies NeedsOption;
    }
    case "credit-payment-amount":
      return {
        type: "Option",
        helperText: `Defeat how many Credits? (${pending.minForced}–${pending.maxUseful})`,
        options: Array.from(
          { length: pending.maxUseful - pending.minForced + 1 },
          (_, i) => String(pending.minForced + i),
        ),
      } satisfies NeedsOption;
    case "bamboozle-alt-cost":
      return {
        type: "Option",
        helperText: `Discard a Cunning card from your hand instead of paying ${pending.fullCost} resource(s)?`,
        options: ["Yes", "No"],
        yesLabel: "Discard Cunning",
        noLabel: `Pay ${pending.fullCost}`,
      } satisfies NeedsOption;
    case "bamboozle-alt-cost-discard":
      return {
        type: "Target",
        fromZones: ["Hand"],
        handOwner: pending.playingPlayer,
        fromIndices: pending.eligibleHandIndices,
      } satisfies NeedsTarget;
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
    case "trigger-order":
      return {
        type: "Option",
        helperText: "Choose which trigger to resolve first:",
        options: pending.triggers.map(t => t.label),
      } satisfies NeedsOption;
    case "trigger-player-order":
      return {
        type: "Option",
        helperText: "Which Triggers Should Resolve First?",
        options: ["Mine", "Theirs"],
      } satisfies NeedsOption;
    case "play-from-hand":
      return { type: "Target", fromZones: ["Hand"], handOwner: pending.player } satisfies NeedsTarget;
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
    case "spread-heal":
      return {
        type: "SpreadDamage",
        totalDamage: pending.maxHeal,
        optional: true,
        eligiblePlayIds: pending.eligiblePlayIds,
        includesBase: pending.eligiblePlayIds.some(id => /^player[12]\.base$/.test(id)),
        mode: "heal",
      } satisfies NeedsSpreadDamage;
    case "choose-indirect-target":
      return {
        type: "Option",
        helperText: `Deal ${pending.totalDamage} indirect damage to which player?`,
        options: ["Opponent", "Yourself"],
      } satisfies NeedsOption;
    case "indirect-damage":
      return {
        type: "SpreadDamage",
        totalDamage: pending.totalDamage,
        optional: false,
        eligiblePlayIds: pending.eligibleUnitPlayIds,
        includesBase: true,
        assigningPlayer: pending.targetPlayer,
      } satisfies NeedsSpreadDamage;
    case "on-attack-order":
      return {
        type: "Option",
        helperText: "Choose which On Attack ability to resolve first:",
        options: pending.triggers.map(t => t.label),
      } satisfies NeedsOption;
    case "deck-search":
      let helperText = `Search top ${pending.topCards.length} cards of your deck`;
      if (pending.maxChoices === 1) helperText += " and choose 1.";
      else if (pending.maxChoices && pending.maxChoices > 1) helperText += ` and choose up to ${pending.maxChoices}.`;

      if (pending.maxCombinedCost && pending.maxCombinedCost > 0) {
        helperText += ` Chosen cards must have combined cost ${pending.maxCombinedCost} or less.`;
      }

      if (pending.costModifier) {
        if (pending.costModifier === 'free') {
          helperText += " Chosen cards will be played for free.";
        } else {
          helperText += ` Costs are ${pending.costModifier < 0 ? 'reduced' : 'increased'} by ${pending.costModifier}.`;
        }
      }

      return {
        type: "DeckSearch",
        helperText,
        choices: pending.eligibleChoices,
        action: pending.action,
        maxChoices: pending.maxChoices,
        maxCombinedCost: pending.maxCombinedCost,
        costModifier: pending.costModifier,
        dontReveal: pending.dontReveal,
      } satisfies NeedsDeckSearch;
    case "reveal-discard":
      return {
        type: "RevealDiscard",
        helperText: `${CardTitle(pending.cardId)}: choose any cards to discard. The rest return to the top of your deck.`,
        choices: pending.revealedCards,
      } satisfies NeedsRevealDiscard;
    case "peek-hand": {
      const targetHand = GetPlayer(game, pending.targetPlayer).hand;
      const eligibleIndices = pending.mustDiscard
        ? targetHand.reduce<number[]>((acc, card, i) => {
            if (!pending.discardFilter) return [...acc, i];
            if (pending.discardFilter === "non-unit" && CardType(card.cardId) !== "Unit") return [...acc, i];
            return acc;
          }, [])
        : targetHand.map((_, i) => i);
      return {
        type: "PeekHand",
        targetPlayer: pending.targetPlayer,
        mustDiscard: pending.mustDiscard,
        eligibleIndices,
      } satisfies NeedsPeekHand;
    }
    case "reveal-from-hand":
      return {
        type: "Target",
        fromZones: ["Hand"],
        handOwner: pending.player,
        fromIndices: pending.eligibleIndices,
        needsMultiple: true,
        maxTargets: pending.maxCount,
      } satisfies NeedsTarget;
    case "dont-get-cocky": {
      const totalCost223 = pending.revealedCards.reduce((sum, c) => sum + c.cost, 0);
      const canReveal223 = pending.revealedCards.length < 7;
      return {
        type: "DontGetCocky",
        targetPlayId: pending.targetPlayId,
        revealedCards: pending.revealedCards,
        totalCost: totalCost223,
        canReveal: canReveal223,
      } satisfies NeedsDontGetCocky;
    }
    case "mill":
    case "mill-result": throw new Error(`${pending.type} should be processed inline and never reach the client.`);
    case "choose-aspect-effect":
      return {
        type: "Option",
        helperText: `${CardTitle(pending.cardId)}: choose an effect.`,
        options: pending.remainingEffects,
      } satisfies NeedsOption;
    default: throw new Error(`Unknown pending resolution type: ${pending.type}`);
  }
}

// ---------------------------------------------------------------------------
// Internal result type
// ---------------------------------------------------------------------------

/**
 * Set when the player has just answered a Credit prompt: re-run `pending.replayDispatch`,
 * defeating `spend` Credits for its paymentIndex-th payment. handleChooseOption only sees
 * the cloned game state, not the caller's context, so it cannot replay itself — runDispatch
 * does, and discards whatever `response` accompanied this marker.
 */
interface CreditReplay {
  pending: CreditPaymentOptionPending | CreditPaymentAmountPending;
  spend: number;
}

interface HandlerResult {
  response: DispatchResponse;
  pending: PendingResolution | null;
  /** True when an irreversible game state change occurred (snapshot history). */
  stateChanged: boolean;
  creditReplay?: CreditReplay;
}

/** The player answered a Credit prompt: hand runDispatch the replay it needs to perform. */
function replayWithCredits(
  game: GameState,
  pending: CreditPaymentOptionPending | CreditPaymentAmountPending,
  spend: number,
): HandlerResult {
  // `response` is a placeholder — runDispatch replaces it with the replayed run's response.
  return { response: stateResponse(game), pending, stateChanged: false, creditReplay: { pending, spend } };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Finishes playing a card after cost has been paid and the card removed from hand.
 * Handles Unit placement, Upgrade targeting, Event resolution, and trigger draining.
 */

/** Builds the "choose a base to deal SEC_264 damage to" ability-target step. */
function sec264BaseTargetPending(
  player: PlayerId,
  _amount: number,
  attackContinuation: PendingResolution | null,
): AbilityTargetPending {
  return {
    type: "ability-target",
    cardId: "SEC_264",
    player,
    fromPlayIds: [],
    fromZones: ["Base"],
    continuation: attackContinuation,
  };
}

/**
 * Duplicate-unique rule: returns a defeat prompt for the first unique card the player
 * controls more than one copy of, or null if there is no conflict. Used by every unit-entry
 * path so uniqueness always interrupts and resolves before the entering unit's own effects.
 */
function uniquenessDefeatPending(game: GameState, player: PlayerId): DefeatCopyPending | null {
  const controlled = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena] as Unit[];
  const checked = new Set<string>();
  for (const u of controlled) {
    if (checked.has(u.cardId) || !CardIsUnique(u.cardId)) continue;
    checked.add(u.cardId);
    const copies = controlled.filter(c => c.cardId === u.cardId);
    if (copies.length > 1) {
      return { type: "defeat-copy", eligiblePlayIds: copies.map(c => c.playId), enteringPlayer: player };
    }
  }
  return null;
}

/**
 * Queues an entering unit's own post-entry effects (Colonel Yularen heal, Shielded,
 * injected effects, Fighters-for-Freedom / Boba Fett reactions, Ambush, When Played).
 *
 * Invoked either directly during a normal play (no uniqueness conflict) or by the
 * defeat-copy handler AFTER the duplicate-unique defeat has been resolved — because
 * uniqueness must interrupt and resolve before any of the entering unit's effects.
 *
 * When `deferWhenPlayed` is false, an interactive When Played is returned so the caller
 * can present it immediately. When true (post-uniqueness resume), When Played is pushed
 * to the trigger bag instead, so it resolves after the just-defeated copy's own triggers.
 */
/**
 * SHD_172 Krayt Dragon: "When an opponent plays a card: You may deal damage equal to that
 * card's cost to their base or a ground unit they control." Pushes one card-played-reaction
 * per Krayt Dragon the opponent-of-the-player controls. `nested` must match the sibling
 * triggers of the just-played card so the active player orders them together (CR 7.6.10).
 */
function queueKraytReactions(game: GameState, playerWhoPlayed: PlayerId, cardId: string, nested: boolean): void {
  const kraytController = GetOtherPlayer(playerWhoPlayed);
  const kraytUnits = [...GetPlayer(game, kraytController).groundArena, ...GetPlayer(game, kraytController).spaceArena]
    .filter(u => u.cardId === "SHD_172" && !Unit.FromInterface(u).LostAbilities());
  for (const krayt of kraytUnits) {
    game.triggerBag.push({
      triggerType: "card-played-reaction",
      cardId: "SHD_172",
      fromPlayer: kraytController,
      playId: krayt.playId,
      nested,
      context: { playedCardCost: CardCost(cardId) ?? 0, cardPlayer: playerWhoPlayed },
    });
  }
}

/**
 * Leaders that react to their OWN controller playing a card ("When you play <X>: you may …").
 * Front side pays "exhaust this leader" (so only fires when undeployed + ready); the deployed
 * side has no such cost. Each entry filters which played cards trigger it.
 */
function queueLeaderPlayReactions(game: GameState, player: PlayerId, cardId: string, nested: boolean): void {
  const leader = GetPlayer(game, player).leader;
  const canFront = !leader.deployed && leader.ready; // front: exhausting the leader is the cost
  const canDeployed = leader.deployed;
  if (!canFront && !canDeployed) return;

  let matches = false;
  switch (leader.cardId) {
    case "TWI_018": // Quinlan Vos — When you play a unit.
      matches = CardType(cardId) === "Unit";
      break;
    case "SHD_018": // The Mandalorian — When you play an upgrade.
      matches = CardType(cardId) === "Upgrade";
      break;
    case "SHD_014": // Cad Bane — When you play an Underworld card (any type).
      matches = TraitContains(cardId, "Underworld");
      // Deployed: "use this ability only once each round".
      if (matches && canDeployed && !canFront &&
        game.currentEffects.some(e => e.cardId === "SHD_014_usedThisRound" && e.affectedPlayer === player)) {
        matches = false;
      }
      break;
    default:
      return;
  }
  if (!matches) return;

  game.triggerBag.push({
    triggerType: "card-played-reaction",
    cardId: leader.cardId,
    fromPlayer: player,
    nested,
    context: { playedCardCost: CardCost(cardId) ?? 0, cardPlayer: player },
  });
}

function queueUnitEntryTriggers(
  game: GameState,
  log: string[],
  unit: Unit,
  cardId: string,
  player: PlayerId,
  opts: { injectEffect?: Omit<CurrentEffect, "targetPlayId"> } | undefined,
  deferWhenPlayed: boolean,
): PendingResolution | null {
  // Colonel Yularen (SOR_109): when a Command unit is played, heal 1 from base.
  const yularenUnit = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena]
    .find(u => u.cardId === "SOR_109" && !Unit.FromInterface(u).LostAbilities());
  if (yularenUnit && CardAspects(cardId).includes("Command")) {
    const yularenBase = GetPlayer(game, player).base;
    yularenBase.damage = Math.max(0, yularenBase.damage - 1);
    log.push(`${CardTitle("SOR_109")}: healed 1 damage from your base.`);
  }

  // Any triggers pushed while the bag is already non-empty are nested (CR 7.6.11).
  const nested = game.triggerBag.length > 0;

  if (HasShielded(cardId, unit.playId, player)) {
    game.triggerBag.push({ triggerType: "shielded", cardId: unit.cardId, fromPlayer: player, playId: unit.playId, nested });
  }
  if (opts?.injectEffect) {
    game.currentEffects.push({ ...opts.injectEffect, targetPlayId: unit.playId });
  }
  // SOR_143 Fighters for Freedom: when another Aggression card is played, may deal 1 damage to a base.
  if (cardId !== "SOR_143" && CardAspects(cardId).includes("Aggression")) {
    const fffUnit = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena]
      .find(u => u.cardId === "SOR_143" && !Unit.FromInterface(u).LostAbilities());
    if (fffUnit) {
      game.triggerBag.push({ triggerType: "card-played-reaction", cardId: "SOR_143", fromPlayer: player, playId: fffUnit.playId, nested });
    }
  }

  // SHD_172 Krayt Dragon: opponent's Krayt reacts to this unit being played (sibling of the
  // unit's own Shielded/Ambush/When-Played, so the active player orders them together).
  queueKraytReactions(game, player, cardId, nested);

  // Leader "when you play a unit" reactions (e.g. TWI_018 Quinlan Vos).
  queueLeaderPlayReactions(game, player, cardId, nested);

  // Leader-reaction: Boba Fett — when the active player plays a keyword unit
  const leaderState = GetPlayer(game, player).leader;
  if (
    leaderState.cardId === "SHD_008" &&
    !leaderState.deployed &&
    leaderState.ready &&
    HasKeyword(cardId, "Any", unit.playId, player)
  ) {
    game.triggerBag.push({ triggerType: "leader-reaction", cardId: "SHD_008", fromPlayer: player, nested });
  }

  const hasAmbush = HasAmbush(cardId, unit.playId, "Hand", player);
  if (hasAmbush) {
    game.triggerBag.push({ triggerType: "ambush", cardId: unit.cardId, fromPlayer: player, playId: unit.playId, nested });
  }

  if (hasAmbush && CardHasWhenPlayed(unit.cardId)) {
    // Both Ambush and When Played — put both in bag for player to choose ordering,
    // but only add WhenPlayed if it has interactive targets (non-null preview).
    const whenPlayedPreview = resolveWhenPlayed(unit.cardId, player, unit.playId);
    if (whenPlayedPreview !== null) {
      game.triggerBag.push({ triggerType: "when-played", cardId: unit.cardId, fromPlayer: player, playId: unit.playId, nested });
    }
    // If WhenPlayed has no targets, skip adding it — Ambush proceeds alone.
  } else if (!hasAmbush && CardHasWhenPlayed(unit.cardId)) {
    const whenPlayedPending = resolveWhenPlayed(unit.cardId, player, unit.playId);
    if (whenPlayedPending && !deferWhenPlayed) {
      // Interactive WP — hand back to the caller to present immediately; it implicitly
      // takes priority over outer bag triggers.
      return whenPlayedPending;
    }
    // Auto-resolving WP, or interactive WP that must wait for a uniqueness defeat —
    // push to bag (nested if outer triggers are already waiting) to resolve after it.
    game.triggerBag.push({ triggerType: "when-played", cardId: unit.cardId, fromPlayer: player, playId: unit.playId, nested });
  }

  return null;
}

function completePlayCard(
  game: GameState,
  log: string[],
  cardId: string,
  player: PlayerId,
  opts?: {
    injectEffect?: Omit<CurrentEffect, "targetPlayId">;
    enterReady?: boolean;
  },
): HandlerResult {
  // SOR_056 Bendu: consume the discount after a qualifying non-Heroism non-Villainy card is played.
  if (!CardAspects(cardId).includes("Heroism") && !CardAspects(cardId).includes("Villainy")) {
    const benduIdx = game.currentEffects.findIndex(e => e.cardId === "SOR_056" && e.affectedPlayer === player);
    if (benduIdx !== -1) game.currentEffects.splice(benduIdx, 1);
  }

  // SEC_110 GNK Power Droid: consume the discount only when a unit is played.
  if (CardType(cardId) === "Unit") {
    const gnkIdx = game.currentEffects.findIndex(e => e.cardId === "SEC_110" && e.affectedPlayer === player);
    if (gnkIdx !== -1) game.currentEffects.splice(gnkIdx, 1);
  }

  if (CardType(cardId) === "Unit") {
    const unit = addToArena(game, player, cardId, opts?.enterReady ?? cardId === "SOR_193");
    log.push(`${CardTitle(cardId) ?? cardId} entered the ${CardArena(cardId) ?? "ground"} arena.`);
    game.roundState.cardsPlayedThisPhase.push({ fromPlayer: player, cardId, playId: unit.playId });
    game.roundState.cardsPlayedThisRound.push({ fromPlayer: player, cardId, playId: unit.playId, playedAs: "Unit" });
    game.roundState.cardsEnteredPlayThisPhase.push({ fromPlayer: player, cardId, playId: unit.playId, reason: "played" });

    // Duplicate-unique rule: uniqueness must ALWAYS interrupt and resolve first. If the
    // player now controls >1 copy, return the defeat prompt immediately — before any of
    // the entering unit's own effects (Yularen heal, Shielded, Ambush, When Played) run.
    // The defeat-copy handler resumes entry (via queueUnitEntryTriggers) once a copy is
    // chosen, so When Played and friends fire only after the duplicate is defeated.
    if (CardIsUnique(cardId)) {
      const controlled = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena] as Unit[];
      const copies = controlled.filter(u => u.cardId === cardId);
      if (copies.length > 1) {
        const defeatCopyPending: DefeatCopyPending = {
          type: "defeat-copy",
          eligiblePlayIds: copies.map(u => u.playId),
          enteringPlayId: unit.playId,
          enteringCardId: cardId,
          enteringPlayer: player,
          enteringInjectEffect: opts?.injectEffect,
        };
        return { response: resolutionResponse(pendingToResolution(defeatCopyPending, game)), pending: defeatCopyPending, stateChanged: false };
      }
    }

    // No uniqueness conflict — queue the entering unit's own effects now. An interactive
    // When Played is returned so it can be presented immediately.
    const whenPlayedPending = queueUnitEntryTriggers(game, log, unit, cardId, player, opts, false);
    if (whenPlayedPending) {
      return { response: resolutionResponse(pendingToResolution(whenPlayedPending, game)), pending: whenPlayedPending, stateChanged: false };
    }
  } else if (CardType(cardId) === "Upgrade") {
    const eligiblePlayIds = UpgradeEligibleTargets(cardId, game, player);
    const upgradePending: UpgradeTargetPending = {
      type: "upgrade-target",
      upgradeCardId: cardId,
      player,
      fromPlayIds: eligiblePlayIds,
    };
    game.roundState.cardsPlayedThisRound.push({ fromPlayer: player, cardId, playId: "", playedAs: "Upgrade" });
    // SHD_172 Krayt Dragon: opponent's Krayt reacts to this upgrade being played (resolves
    // after the upgrade is attached, when the trigger bag drains).
    queueKraytReactions(game, player, cardId, game.triggerBag.length > 0);
    // Leader "when you play an upgrade" reactions (e.g. SHD_018 The Mandalorian).
    queueLeaderPlayReactions(game, player, cardId, game.triggerBag.length > 0);
    return { response: resolutionResponse(pendingToResolution(upgradePending, game)), pending: upgradePending, stateChanged: false };
  } else {
    // Event branch
    const priorEventCount = game.roundState.cardsPlayedThisRound
      .filter(e => e.fromPlayer === player && e.playedAs === "Event")
      .length;

    pushEventToDiscard(game, player, cardId);
    const eventPlayId = GetPlayer(game, player).discard[0].playId;
    game.roundState.cardsPlayedThisRound.push({ fromPlayer: player, cardId, playId: eventPlayId, playedAs: "Event" });

    // SOR_143 Fighters for Freedom: when another Aggression card is played, may deal 1 damage to a base.
    if (CardAspects(cardId).includes("Aggression")) {
      const fffUnitEvt = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena]
        .find(u => u.cardId === "SOR_143" && !Unit.FromInterface(u).LostAbilities());
      if (fffUnitEvt) {
        const nestedFFF = game.triggerBag.length > 0;
        game.triggerBag.push({ triggerType: "card-played-reaction", cardId: "SOR_143", fromPlayer: player, playId: fffUnitEvt.playId, nested: nestedFFF });
      }
    }

    // SHD_172 Krayt Dragon: opponent's Krayt reacts to this event being played.
    queueKraytReactions(game, player, cardId, game.triggerBag.length > 0);
    // Leader "when you play a card" reactions on events (e.g. SHD_014 Cad Bane / Underworld event).
    queueLeaderPlayReactions(game, player, cardId, game.triggerBag.length > 0);

    // SOR_153 Saw Gerrera: opponent playing an event must deal 2 damage to their own base.
    const sawGerreraOpp = GetOtherPlayer(player);
    const sawGerreraActive = [...GetPlayer(game, sawGerreraOpp).groundArena, ...GetPlayer(game, sawGerreraOpp).spaceArena]
      .some(u => u.cardId === "SOR_153" && !Unit.FromInterface(u).LostAbilities());
    if (sawGerreraActive) {
      dealBaseDamage(game, player, 2);
      log.push(`${CardTitle("SOR_153")}: ${CardTitle(cardId)} cost 2 damage to Player ${player}'s base.`);
    }

    const relentlessOpp = GetOtherPlayer(player);
    const relentlessActive = [...GetPlayer(game, relentlessOpp).groundArena, ...GetPlayer(game, relentlessOpp).spaceArena]
      .some(u => u.cardId === "SOR_089" && !Unit.FromInterface(u).LostAbilities());
    const isEventBlanked = relentlessActive && priorEventCount === 0;

    if (isEventBlanked) {
      log.push(`${CardTitle(cardId) ?? cardId} lost all abilities (${CardTitle("SOR_089")}).`);
    } else {
      log.push(`${CardTitle(cardId) ?? cardId} resolved and placed in the discard.`);

      if (cardId === "SOR_175") {
        // Forced Surrender — Draw 2 cards. Each opponent whose base you've damaged this phase discards 2 cards.
        DrawCardForPlayer(game, log, player);
        DrawCardForPlayer(game, log, player);
        log.push(`${CardTitle("SOR_175")}: drew 2 cards.`);
        const opp175: PlayerId = player === 1 ? 2 : 1;
        const damagedOppBase = (game.roundState.baseDamagedThisPhase ?? []).some(
          e => e.byPlayer === player && e.target === opp175,
        );
        if (damagedOppBase) {
          const oppHandSize175 = GetPlayer(game, opp175).hand.length;
          if (oppHandSize175 > 0) {
            const discard175: DiscardFromHandPending = {
              type: "discard-from-hand",
              targetPlayer: opp175,
              count: Math.min(2, oppHandSize175),
              continuation: null,
            };
            return { response: resolutionResponse(pendingToResolution(discard175, game)), pending: discard175, stateChanged: false };
          }
        }
      } else if (cardId === "SOR_043" || cardId === "TWI_078") {
        const otherPlayer: PlayerId = player === 1 ? 2 : 1;
        // Snapshot trigger-holders before any unit is removed so wiped units still trigger.
        const holdersP1 = GetUnitsForPlayer(1);
        const holdersP2 = GetUnitsForPlayer(2);
        const toDefeat = cardId === "SOR_043"
          ? [...GetUnitsForPlayer(otherPlayer), ...GetUnitsForPlayer(player)]
          : [...GetUnitsForPlayer(otherPlayer)];
        boardWipeDefeat(game, log, toDefeat, holdersP1, holdersP2);
      } else {
        const nextPending = resolveWhenPlayed(cardId, player);
        if (nextPending) {
          return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
        }
      }
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
  const hand = GetPlayer(game, player).hand;
  const idx = hand.findIndex((c) => c.cardId === cardId);

  if (idx === -1)
    return { response: invalidResponse(`Card ${cardId} not found in Player ${player}'s hand.`), pending: null, stateChanged: false };

  if (regionalGovernorBlocks(game, player, cardId))
    return { response: invalidResponse(`Regional Governor prevents playing ${CardTitle(cardId) ?? cardId}.`), pending: null, stateChanged: false };

  const fullCost = playCost(game, player, cardId);
  const exploitAmt = ExploitAmount(cardId, "hand", player, true); // report mode: peek without consuming
  const readyCount = spendableFor(game, player);
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
        payResources(game, player, pilotCost, log, cardId);
        log.push(`Player ${player} is playing ${CardTitle(cardId) ?? cardId} as a Pilot.`);
        game.roundState.cardsPlayedThisRound.push({ fromPlayer: player, cardId, playId: "", playedAs: "Pilot" });
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

  // SOR_199 Bamboozle: may pay an alternate cost (discard a Cunning card) instead of resources.
  if (cardId === "SOR_199") {
    hand.splice(idx, 1);
    const cunningIndices = hand
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => CardAspects(c.cardId).includes("Cunning"))
      .map(({ i }) => i);
    if (cunningIndices.length > 0) {
      // Always ask yes/no when a Cunning card is available as alternate cost.
      const altCostPending: BamboozleAltCostPending = {
        type: "bamboozle-alt-cost",
        playingPlayer: player,
        fullCost,
        cunningHandIndices: cunningIndices,
      };
      return { response: resolutionResponse(pendingToResolution(altCostPending, game)), pending: altCostPending, stateChanged: false };
    }
    // No Cunning card available — fall through to normal affordability check.
    if (readyCount < fullCost) {
      hand.push({ cardId }); // restore card
      return { response: invalidResponse(`Player ${player} cannot afford ${cardId}.`), pending: null, stateChanged: false };
    }
    payResources(game, player, fullCost, log, cardId);
    log.push(`Player ${player} played ${CardTitle(cardId) ?? cardId}.`);
    return completePlayCard(game, log, cardId, player);
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

  // No piloting, no exploit — pay full cost immediately (Credits may cover part of it)
  payResources(game, player, fullCost, log, cardId);
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
  const p = GetPlayer(game, player);

  const resource = p.resources.find(r => r.playId === playId);
  if (!resource)
    return { response: invalidResponse(`Resource ${playId} not found for player ${player}.`), pending: null, stateChanged: false };

  const cost = effectiveSmuggleCost(game, player, resource);
  if (cost === null)
    return { response: invalidResponse(`Resource ${playId} (${resource.cardId}) cannot be Smuggled.`), pending: null, stateChanged: false };

  const readyCount = spendableFor(game, player);
  if (readyCount < cost)
    return { response: invalidResponse(`Player ${player} cannot afford Smuggle cost of ${cost}.`), pending: null, stateChanged: false };

  const { cardId } = resource;
  const wasReady = resource.ready;

  const idx = p.resources.findIndex(r => r.playId === playId);
  p.resources.splice(idx, 1);

  payResources(game, player, Math.max(0, wasReady ? cost - 1 : cost), log, cardId);

  if (p.deck.length > 0) {
    const topCard = p.deck.pop()!;
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

  const attacker = GetUnitByPlayId(game, playId);
  if (!attacker)
    return { response: invalidResponse(`No unit with playId ${playId}.`), pending: null, stateChanged: false };
  if (attacker.controller !== player)
    return { response: invalidResponse(`Unit ${playId} is not controlled by Player ${player}.`), pending: null, stateChanged: false };
  if (!attacker.ready)
    return { response: invalidResponse(`Unit ${playId} is exhausted.`), pending: null, stateChanged: false };

  if (HasOnAttack(attacker.cardId, attacker.controller, attacker.playId)) {
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
  const leader = GetPlayer(game, player).leader;

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

    const abilityCost = ActionAbilityCost(leader.cardId);
    const readyResources = spendableFor(game, player);
    if (readyResources < abilityCost)
      return { response: invalidResponse("Not enough resources to use leader ability."), pending: null, stateChanged: false };

    leader.ready = false;
    payResources(game, player, abilityCost, log, leader.cardId);
    const nextPending = resolveActionAbility(game, log, player, leader.cardId);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  // Unit action ability
  if (data.playId) {
    const unit = GetUnitByPlayId(game, data.playId);
    if (!unit)
      return { response: invalidResponse(`No unit with playId ${data.playId}.`), pending: null, stateChanged: false };
    if (unit.controller !== player)
      return { response: invalidResponse(`Unit ${data.playId} is not controlled by Player ${player}.`), pending: null, stateChanged: false };
    if (!unit.ready)
      return { response: invalidResponse(`${CardTitle(unit.cardId)} is exhausted.`), pending: null, stateChanged: false };
    const unitAbilities = ActionAbilities(unit.cardId, player, data.playId);
    if (!unitAbilities.includes(unit.cardId))
      return { response: invalidResponse(`${CardTitle(unit.cardId)} has no available action ability.`), pending: null, stateChanged: false };
    const unitAbilityCost = ActionAbilityCost(unit.cardId);
    const readyResourceCount = spendableFor(game, player);
    if (readyResourceCount < unitAbilityCost)
      return { response: invalidResponse(`Not enough resources to use ${CardTitle(unit.cardId)}'s ability.`), pending: null, stateChanged: false };

    // SOR_110 Frontline Shuttle: cost is defeating the unit, not exhausting it.
    if (unit.cardId === "SOR_110") {
      const nextPending110 = resolveActionAbility(game, log, player, unit.cardId, unit.playId);
      if (nextPending110) {
        return { response: resolutionResponse(pendingToResolution(nextPending110, game)), pending: nextPending110, stateChanged: false };
      }
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    unit.ready = false;
    payResources(game, player, unitAbilityCost, log, unit.cardId);

    const nextPending = resolveActionAbility(game, log, player, unit.cardId, unit.playId);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  // Base epic action
  const base = GetPlayer(game, player).base;
  if (base.cardId === data.cardId) {
    return handleBaseEpicAction(game, log, player);
  }

  return { response: invalidResponse("use-ability requires a leader cardId or a unit playId."), pending: null, stateChanged: false };
}

function handleBaseEpicAction(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const base = GetPlayer(game, player).base;
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
  GetPlayer(game, player).base.epicActionUsed = true;

  const readyCount = spendableFor(game, player);
  const eligible = GetPlayer(game, player).hand.filter(c =>
    CardType(c.cardId) === "Unit" &&
    (CardCost(c.cardId) ?? 0) <= 6 &&
    playCost(game, player, c.cardId) <= readyCount
  );

  if (eligible.length === 0) {
    log.push(`Player ${player} used Energy Conversion Lab — no eligible units to play.`);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  log.push(`Player ${player} used Energy Conversion Lab.`);
  const pending: PlayFromHandPending = { type: "play-from-hand", cardId: "SOR_022", player };
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
      if (pending.source === "SOR_110") {
        return { response: invalidResponse("Frontline Shuttle action: cannot attack a base."), pending, stateChanged: false };
      }
      const atkController = GetUnitByPlayId(game, pending.attackerPlayId)?.controller;
      if (atkController != null) target = { type: "base", player: GetOtherPlayer(atkController) };
      attacker = GetUnitByPlayId(game, pending.attackerPlayId);
    } else if (data.targetPlayIds?.[0]) {
      const chosen = data.targetPlayIds[0];
      attacker = GetUnitByPlayId(game, pending.attackerPlayId);
      if (!attacker)
        return { response: invalidResponse("Attacker no longer in play."), pending: null, stateChanged: false };
      const { unitPlayIds } = computeAttackTargets(game, attacker);
      if (!unitPlayIds.includes(chosen))
        return { response: invalidResponse(`Unit ${chosen} is not a legal attack target.`), pending, stateChanged: false };
      target = { type: "unit", playId: chosen };
    }

    if (!target)
      return { response: invalidResponse("choose-target must include targetPlayIds or targetZones containing 'Base'."), pending, stateChanged: false };

    // Anakin Skywalker (TWI_012) leader Action: the attacker gets +2/+0 for this attack if it is attacking a unit.
    if (pending.source === "TWI_012" && target.type === "unit" && attacker) {
      game.currentEffects.push({ cardId: "TWI_012_action", duration: "ForAttack", affectedPlayer: attacker.controller, targetPlayId: attacker.playId });
      log.push(`${CardTitle("TWI_012")}: attacking a unit — +2/+0 for this attack.`);
    }

    // Ability-initiated attacks (e.g. Rebel Assault, Precision Fire) skip handleAttack,
    // so queue the on-attack trigger now if it wasn't already.
    if (attacker && HasOnAttack(attacker.cardId, attacker.controller, attacker.playId)) {
      const alreadyQueued = game.triggerBag.some(t => t.triggerType === "on-attack");
      if (!alreadyQueued) {
        game.triggerBag.push({ triggerType: "on-attack", cardId: attacker.cardId, fromPlayer: attacker.controller });
      }
    }

    const resolveAttackPending: ResolveAttackPending = {
      type: "resolve-attack",
      attackerPlayId: pending.attackerPlayId,
      target,
      continuation: pending.continuation ?? null,
    };

    const onAttackTriggerIndex = game.triggerBag.findIndex(t => t.triggerType === "on-attack");
    const onAttackTriggerPending = attacker && onAttackTriggerIndex !== -1
      ? (game.triggerBag.splice(onAttackTriggerIndex, 1), resolveOnAttackTrigger(attacker, resolveAttackPending))
      : null;
    if (onAttackTriggerPending) {
      if (onAttackTriggerPending.type === "resolve-attack") {
        return handleResolveAttack(game, log, onAttackTriggerPending);
      }
      if (onAttackTriggerPending.type === "mill") {
        const afterMill = processMill(game, log, onAttackTriggerPending);
        if (afterMill?.type === "resolve-attack") return handleResolveAttack(game, log, afterMill);
        if (afterMill) return { response: resolutionResponse(pendingToResolution(afterMill, game)), pending: afterMill, stateChanged: true };
        const bagMill = drainTriggerBag(game, log);
        if (bagMill) return { response: resolutionResponse(pendingToResolution(bagMill, game)), pending: bagMill, stateChanged: true };
        updateDefeatedPlayers(game);
        return { response: stateResponse(game), pending: null, stateChanged: true };
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
    const playerState = GetPlayer(game, pending.player);
    const resourceIdx = playerState.resources.findIndex(r => r.playId === chosenPlayId);
    if (resourceIdx === -1)
      return { response: invalidResponse("Plot resource not found."), pending, stateChanged: false };
    const resource = playerState.resources[resourceIdx];
    if (!HasPlot(resource.cardId))
      return { response: invalidResponse("Chosen card is not a Plot card."), pending, stateChanged: false };
    if (!canAfford(game, pending.player, resource.cardId))
      return { response: invalidResponse("Not enough resources to play this Plot card."), pending, stateChanged: false };

    payResources(game, pending.player, playCost(game, pending.player, resource.cardId), log, resource.cardId);
    playerState.resources.splice(resourceIdx, 1);
    if (playerState.deck.length > 0) {
      const topCard = playerState.deck.pop()!;
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

  // SOR_187 I Had No Choice: multi-select step — player picks up to 2 non-leader units.
  if (pending.type === "ability-target" && pending.cardId === "SOR_187") {
    const chosenIds = data.targetPlayIds ?? [];
    for (const id of chosenIds) {
      if (!pending.fromPlayIds.includes(id))
        return { response: invalidResponse(`Unit ${id} is not a valid target for I Had No Choice.`), pending, stateChanged: false };
    }
    if (chosenIds.length === 0) {
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }
    if (chosenIds.length === 1) {
      const result187 = removeFromArena(game, chosenIds[0]);
      if (result187 && !result187.unit.IsTokenUnit()) {
        GetPlayer(game, result187.unit.owner).hand.push({ cardId: result187.unit.cardId });
        log.push(`${CardTitle("SOR_187")}: returned ${CardTitle(result187.unit.cardId)} to Player ${result187.unit.owner}'s hand.`);
      }
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }
    // 2 units chosen: opponent picks which one goes to hand (the other goes to deck bottom)
    const opp187: PlayerId = pending.player === 1 ? 2 : 1;
    const oppPending: AbilityTargetPending = {
      type: "ability-target",
      cardId: "SOR_187_opp",
      player: opp187,
      fromPlayIds: chosenIds,
      continuation: null,
    };
    return { response: resolutionResponse(pendingToResolution(oppPending, game)), pending: oppPending, stateChanged: true };
  }

  if (pending.type === "ability-target") {
    const chosen = data.targetPlayIds?.[0];
    const chosenBase = data.targetZones?.includes("Base") ?? false;

    if (!chosen && !chosenBase)
      return { response: invalidResponse("choose-target must include targetPlayIds or targetZones."), pending, stateChanged: false };
    if (chosen && pending.fromPlayIds.length > 0 && !pending.fromPlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid ability target.`), pending, stateChanged: false };

    // Multi-target aspect effects handled before single-target dispatch
    if (pending.cardId === "SOR_155_defeat_upgrades" || pending.cardId === "SOR_203_exhaust_2") {
      const multiTargets = data.targetPlayIds ?? [];
      if (pending.cardId === "SOR_155_defeat_upgrades") {
        for (const upgPlayId of multiTargets.slice(0, 2)) {
          for (const u of GetAllUnits(game)) {
            const upgradeIdx = u.upgrades.findIndex(upg => upg.playId === upgPlayId);
            if (upgradeIdx !== -1) {
              const [defeated155] = u.upgrades.splice(upgradeIdx, 1);
              log.push(`${CardTitle("SOR_155")}: defeated ${CardTitle(defeated155.cardId)} on ${CardTitle(u.cardId)}.`);
              if (defeated155.cardId === "SOR_122" && u.controller !== u.owner) {
                transferControl(game, log, u, u.owner);
              }
              break;
            }
          }
        }
      } else {
        for (const unitPlayId of multiTargets.slice(0, 2)) {
          const target203e = GetUnitByPlayId(game, unitPlayId);
          if (target203e) {
            target203e.ready = false;
            log.push(`${CardTitle("SOR_203")}: exhausted ${CardTitle(target203e.cardId)}.`);
          }
        }
      }
      updateDefeatedPlayers(game);
      const nextMulti = pending.continuation;
      if (nextMulti) return { response: resolutionResponse(pendingToResolution(nextMulti, game)), pending: nextMulti, stateChanged: true };
      const bagMulti = drainTriggerBag(game, log);
      if (bagMulti) return { response: resolutionResponse(pendingToResolution(bagMulti, game)), pending: bagMulti, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

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
      return { response: resolutionResponse(pendingToResolution(bagAfterAbility, game)), pending: bagAfterAbility, stateChanged: false };
    }
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "return-from-discard") {
    const chosen = data.targetPlayIds ?? [];
    const invalid = chosen.find(id => !pending.eligiblePlayIds.includes(id));
    if (invalid)
      return { response: invalidResponse(`Card ${invalid} is not eligible for return from discard.`), pending, stateChanged: false };

    if (pending.cardId === "LAW_238") {
      // Scavenging Sandcrawler: move the chosen card to the bottom of the deck, then create a Credit.
      const player238 = pending.player;
      const pState238 = GetPlayer(game, player238);
      const playId238 = chosen[0];
      const idx238 = pState238.discard.findIndex(d => d.playId === playId238);
      if (idx238 !== -1) {
        const card238 = pState238.discard.splice(idx238, 1)[0];
        pState238.deck.unshift({ cardId: card238.cardId }); // bottom of deck (top is popped from the end)
        CreateCreditToken(game, player238, log, "LAW_238");
        log.push(`${CardTitle("LAW_238")}: put ${CardTitle(card238.cardId)} on the bottom of the deck.`);
      }
      const next238 = pending.continuation;
      if (next238?.type === "resolve-attack") return handleResolveAttack(game, log, next238);
      if (next238) return { response: resolutionResponse(pendingToResolution(next238, game)), pending: next238, stateChanged: false };
      const bag238 = drainTriggerBag(game, log);
      if (bag238) return { response: resolutionResponse(pendingToResolution(bag238, game)), pending: bag238, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    if (pending.cardId === "SOR_252") {
      // Place chosen cards at the bottom of their owner's deck in a random order.
      const toPlace: { cardId: string; ownerDeck: { cardId: string }[] }[] = [];
      for (const playId of chosen.slice(0, pending.maxCount)) {
        for (const pId of [1, 2] as PlayerId[]) {
          const pState252 = GetPlayer(game, pId);
          const idx = pState252.discard.findIndex(d => d.playId === playId);
          if (idx !== -1) {
            const card = pState252.discard.splice(idx, 1)[0];
            toPlace.push({ cardId: card.cardId, ownerDeck: GetPlayer(game, card.owner as PlayerId).deck });
            break;
          }
        }
      }
      for (let i = toPlace.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [toPlace[i], toPlace[j]] = [toPlace[j], toPlace[i]];
      }
      const titles252: string[] = [];
      for (const { cardId: cId, ownerDeck } of toPlace) {
        ownerDeck.unshift({ cardId: cId });
        titles252.push(CardTitle(cId) ?? cId);
      }
      if (titles252.length > 0)
        log.push(`${CardTitle("SOR_252")}: placed ${titles252.join(", ")} on the bottom of their owner's deck.`);
      const next252 = pending.continuation;
      if (next252)
        return { response: resolutionResponse(pendingToResolution(next252, game)), pending: next252, stateChanged: false };
      const bag252 = drainTriggerBag(game, log);
      if (bag252)
        return { response: resolutionResponse(pendingToResolution(bag252, game)), pending: bag252, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    // SOR_102 Home One: play chosen Heroism unit from discard at cost -3.
    if (pending.cardId === "SOR_102") {
      const playId102 = chosen[0];
      if (!playId102) {
        const bag102a = drainTriggerBag(game, log);
        if (bag102a) return { response: resolutionResponse(pendingToResolution(bag102a, game)), pending: bag102a, stateChanged: true };
        return { response: stateResponse(game), pending: null, stateChanged: true };
      }
      const playerState102 = GetPlayer(game, pending.player);
      const idx102 = playerState102.discard.findIndex(d => d.playId === playId102);
      if (idx102 === -1)
        return { response: invalidResponse("Home One: card not found in discard."), pending, stateChanged: false };
      const cardId102 = playerState102.discard[idx102].cardId;
      const reducedCost102 = Math.max(0, playCost(game, pending.player, cardId102) - 3);
      const ready102 = spendableFor(game, pending.player);
      if (ready102 < reducedCost102)
        return { response: invalidResponse(`Home One: not enough resources to play ${CardTitle(cardId102)} (needs ${reducedCost102}).`), pending, stateChanged: false };
      playerState102.discard.splice(idx102, 1);
      payResources(game, pending.player, reducedCost102, log, cardId102);
      log.push(`${CardTitle("SOR_102")}: played ${CardTitle(cardId102)} from discard (cost -3 = ${reducedCost102}).`);
      return completePlayCard(game, log, cardId102, pending.player);
    }

    // SOR_183 Bounty Hunter Crew (Han Solo): return an event from either player's discard to its owner's hand.
    if (pending.cardId === "SOR_183") {
      const returned183: string[] = [];
      for (const rPlayId of chosen.slice(0, pending.maxCount)) {
        for (const pId of [1, 2] as PlayerId[]) {
          const pState183 = GetPlayer(game, pId);
          const idx183 = pState183.discard.findIndex(d => d.playId === rPlayId);
          if (idx183 !== -1) {
            const card183 = pState183.discard.splice(idx183, 1)[0];
            GetPlayer(game, card183.owner as PlayerId).hand.push({ cardId: card183.cardId });
            returned183.push(CardTitle(card183.cardId) ?? card183.cardId);
            break;
          }
        }
      }
      if (returned183.length > 0)
        log.push(`${CardTitle("SOR_183")}: returned ${returned183.join(", ")} to hand.`);
      const next183 = pending.continuation;
      if (next183) return { response: resolutionResponse(pendingToResolution(next183, game)), pending: next183, stateChanged: false };
      const bag183 = drainTriggerBag(game, log);
      if (bag183) return { response: resolutionResponse(pendingToResolution(bag183, game)), pending: bag183, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    const playerState = GetPlayer(game, pending.player);
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

    // SOR_197 Lando Calrissian: return chosen resources to hand (reuses give-xp-multiple multi-select UI)
    if (pending.cardId === "SOR_197") {
      const pState197 = GetPlayer(game, pending.player);
      const returned197: string[] = [];
      for (const rPlayId of chosen) {
        const idx197 = pState197.resources.findIndex(r => r.playId === rPlayId);
        if (idx197 !== -1) {
          const card197 = pState197.resources.splice(idx197, 1)[0];
          pState197.hand.push({ cardId: card197.cardId });
          returned197.push(CardTitle(card197.cardId) ?? card197.cardId);
        }
      }
      if (returned197.length > 0)
        log.push(`${CardTitle("SOR_197")}: returned ${returned197.join(", ")} to hand.`);
      const next197 = pending.continuation;
      if (next197) return { response: resolutionResponse(pendingToResolution(next197, game)), pending: next197, stateChanged: false };
      const bag197 = drainTriggerBag(game, log);
      if (bag197) return { response: resolutionResponse(pendingToResolution(bag197, game)), pending: bag197, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    const gifted: string[] = [];
    for (const playId of chosen) {
      const target = GetUnitByPlayId(game, playId);
      if (target) {
        target.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: target.owner, controller: target.controller });
        gifted.push(CardTitle(target.cardId) ?? target.cardId);
      }
    }
    if (gifted.length > 0)
      log.push(`${CardTitle(pending.cardId)}: gave Experience to ${gifted.join(", ")}.`);
    const next = pending.continuation;
    // An On Attack give-XP (e.g. SEC_085 Rampart's disclose) is followed by the pending
    // combat resolution; a resolve-attack continuation must be executed, not rendered.
    if (next?.type === "resolve-attack") return handleResolveAttack(game, log, next);
    if (next)
      return { response: resolutionResponse(pendingToResolution(next, game)), pending: next, stateChanged: false };
    const bagAfterXp = drainTriggerBag(game, log);
    if (bagAfterXp)
      return { response: resolutionResponse(pendingToResolution(bagAfterXp, game)), pending: bagAfterXp, stateChanged: false };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "peek-hand") {
    if (!pending.mustDiscard) {
      // Just a peek — no discard required, player dismisses with any dispatch
      log.push(`Player ${pending.peekingPlayer} looked at Player ${pending.targetPlayer}'s hand.`);
      const cont = pending.continuation ?? null;
      if (cont) return { response: resolutionResponse(pendingToResolution(cont, game)), pending: cont, stateChanged: false };
      const bag = drainTriggerBag(game, log);
      if (bag) return { response: resolutionResponse(pendingToResolution(bag, game)), pending: bag, stateChanged: false };
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    const idx = data.targetIndices?.[0];
    if (idx == null)
      return { response: invalidResponse("Choose a card to discard from the opponent's hand."), pending, stateChanged: false };
    const targetHand = GetPlayer(game, pending.targetPlayer).hand;
    if (idx < 0 || idx >= targetHand.length)
      return { response: invalidResponse("Invalid hand index."), pending, stateChanged: false };
    // Validate filter
    if (pending.discardFilter === "non-unit" && CardType(targetHand[idx].cardId) === "Unit")
      return { response: invalidResponse("Only non-unit cards can be discarded here."), pending, stateChanged: false };

    const [discarded] = targetHand.splice(idx, 1);
    pushEventToDiscard(game, pending.targetPlayer, discarded.cardId);
    log.push(`Player ${pending.peekingPlayer} discarded ${CardTitle(discarded.cardId)} from Player ${pending.targetPlayer}'s hand.`);
    const cont = pending.continuation ?? null;
    if (cont) return { response: resolutionResponse(pendingToResolution(cont, game)), pending: cont, stateChanged: false };
    const bag = drainTriggerBag(game, log);
    if (bag) return { response: resolutionResponse(pendingToResolution(bag, game)), pending: bag, stateChanged: false };
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "bamboozle-alt-cost-discard") {
    const idx = data.targetIndices?.[0];
    if (idx == null)
      return { response: invalidResponse("Choose a Cunning card from your hand to discard."), pending, stateChanged: false };
    if (!pending.eligibleHandIndices.includes(idx))
      return { response: invalidResponse("Chosen card is not a valid Cunning card."), pending, stateChanged: false };
    const playerHand = GetPlayer(game, pending.playingPlayer).hand;
    if (idx < 0 || idx >= playerHand.length)
      return { response: invalidResponse("Invalid hand index."), pending, stateChanged: false };
    const [discarded] = playerHand.splice(idx, 1);
    log.push(`Player ${pending.playingPlayer} discarded ${CardTitle(discarded.cardId)} as alternate cost for ${CardTitle("SOR_199")}.`);
    return completePlayCard(game, log, "SOR_199", pending.playingPlayer);
  }

  if (pending.type === "discard-from-hand") {
    const idx = data.targetIndices?.[0];
    if (idx == null)
      return { response: invalidResponse("Choose a card index to discard."), pending, stateChanged: false };
    const playerHand = GetPlayer(game, pending.targetPlayer).hand;
    if (idx < 0 || idx >= playerHand.length)
      return { response: invalidResponse("Invalid hand index."), pending, stateChanged: false };
    const [discardedCard] = playerHand.splice(idx, 1);
    const discardedCost = CardCost(discardedCard.cardId) ?? 0;
    log.push(`Player ${pending.targetPlayer} discarded a card.`);
    const remaining = pending.count - 1;
    let nextPending: PendingResolution | null = remaining > 0
      ? { type: "discard-from-hand", targetPlayer: pending.targetPlayer, count: remaining, continuation: pending.continuation }
      : (pending.continuation ?? null);

    // SOR_167 Force Throw: if a Force unit is in play for the controller, offer damage equal to discarded card's cost.
    if (remaining === 0 && pending.forceThrowControllerPlayer !== undefined && discardedCost > 0) {
      const allUnits167 = GetAllUnits(game);
      if (allUnits167.length > 0) {
        const damageOffer: AbilityOptionPending = {
          type: "ability-option",
          cardId: "SOR_167_damage_offer",
          player: pending.forceThrowControllerPlayer,
          helperText: `Deal ${discardedCost} damage to a unit?`,
          yesLabel: `Deal ${discardedCost} damage`,
          noLabel: "Skip",
          onYes: {
            type: "ability-target",
            cardId: "SOR_167_damage",
            player: pending.forceThrowControllerPlayer,
            fromPlayIds: allUnits167.map(u => u.playId),
            continuation: null,
          },
          continuation: null,
        };
        game.currentEffects.push({ cardId: "SOR_167_damage", duration: "Phase", affectedPlayer: pending.forceThrowControllerPlayer, value: discardedCost });
        nextPending = damageOffer;
      }
    }
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "reveal-from-hand") {
    const chosenIndices = (data.targetIndices ?? []).filter(i => pending.eligibleIndices.includes(i)).slice(0, pending.maxCount);
    const unit035 = GetUnitByPlayId(game, pending.sourcePlayId);
    if (unit035 && chosenIndices.length > 0) {
      const pHand035 = GetPlayer(game, pending.player).hand;
      const revealedNames = chosenIndices.map(i => CardTitle(pHand035[i]?.cardId ?? "")).filter(Boolean);
      for (let i = 0; i < chosenIndices.length; i++) {
        unit035.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: unit035.owner, controller: unit035.controller });
      }
      log.push(`${CardTitle(pending.cardId)}: revealed ${revealedNames.join(", ")} — gained ${chosenIndices.length} Experience token(s).`);
    } else if (chosenIndices.length === 0) {
      log.push(`${CardTitle(pending.cardId)}: no Vigilance cards revealed.`);
    }
    const next035 = pending.continuation;
    if (next035) return { response: resolutionResponse(pendingToResolution(next035, game)), pending: next035, stateChanged: false };
    const bag035 = drainTriggerBag(game, log);
    if (bag035) return { response: resolutionResponse(pendingToResolution(bag035, game)), pending: bag035, stateChanged: false };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "defeat-copy") {
    const chosen = data.targetPlayIds?.[0];
    if (!chosen)
      return { response: invalidResponse("choose-target must include targetPlayIds to resolve uniqueness."), pending, stateChanged: false };
    if (!pending.eligiblePlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid uniqueness choice.`), pending, stateChanged: false };
    const unit = GetUnitByPlayId(game, chosen);
    if (!unit)
      return { response: invalidResponse("Chosen unit not found."), pending, stateChanged: false };
    const defeatedPending = defeatUnit(game, log, unit);
    updateDefeatedPlayers(game);

    // Uniqueness is now resolved — resume the entering unit's own entry (Shielded,
    // Ambush, When Played, reactions). When Played is deferred to the bag so it resolves
    // after the just-defeated copy's own triggers. (Only the single-entry play-a-card
    // path sets enteringPlayId; deck-search plays already queued their triggers.)
    if (pending.enteringPlayId && pending.enteringCardId && pending.enteringPlayer) {
      const entering = GetUnitByPlayId(game, pending.enteringPlayId);
      if (entering) {
        queueUnitEntryTriggers(
          game, log, entering, pending.enteringCardId, pending.enteringPlayer,
          pending.enteringInjectEffect ? { injectEffect: pending.enteringInjectEffect } : undefined,
          true,
        );
      } else if (CardHasWhenPlayed(pending.enteringCardId)) {
        // The player defeated the just-played copy itself. Per CR 8.29.3, abilities that
        // trigger upon that copy being played must still resolve. The entry effects that
        // need the unit in play (Shielded, Ambush, injected effects) are moot now that it
        // is gone, but its When Played still fires — queue it to the bag so it resolves
        // after the just-defeated copy's own When Defeated triggers.
        game.triggerBag.push({
          triggerType: "when-played",
          cardId: pending.enteringCardId,
          fromPlayer: pending.enteringPlayer,
          playId: pending.enteringPlayId,
          nested: game.triggerBag.length > 0,
        });
      }
    }

    const cont = pending.continuation ?? null;

    // If more than two copies entered at once (multiple duplicates), keep prompting —
    // uniqueness must resolve fully before anything downstream.
    if (pending.enteringPlayer) {
      const nextConflict = uniquenessDefeatPending(game, pending.enteringPlayer);
      if (nextConflict) {
        nextConflict.continuation = cont;
        return { response: resolutionResponse(pendingToResolution(nextConflict, game)), pending: nextConflict, stateChanged: true };
      }
    }

    // The defeated copy's own When Defeated (if any) interrupts first; the entering unit's
    // queued triggers and any downstream continuation resolve after it.
    if (defeatedPending) {
      const chained = injectContinuation(defeatedPending, cont);
      return { response: resolutionResponse(pendingToResolution(chained, game)), pending: chained, stateChanged: false };
    }
    const uniquenessBag = drainTriggerBag(game, log);
    if (uniquenessBag) {
      const chained = injectContinuation(uniquenessBag, cont);
      return { response: resolutionResponse(pendingToResolution(chained, game)), pending: chained, stateChanged: true };
    }
    if (cont) return { response: resolutionResponse(pendingToResolution(cont, game)), pending: cont, stateChanged: true };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "upgrade-target") {
    const chosen = data.targetPlayIds?.[0];
    if (!chosen)
      return { response: invalidResponse("choose-target must include targetPlayIds for upgrade attachment."), pending, stateChanged: false };
    if (!pending.fromPlayIds.includes(chosen))
      return { response: invalidResponse(`Unit ${chosen} is not a valid upgrade target.`), pending, stateChanged: false };

    const targetUnit = GetUnitByPlayId(game, chosen);
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
      GetPlayer(game, pending.player).leader.deployedPlayId = upgradeInPlay.playId;
    }
    const isPilot = PilotingCost(pending.upgradeCardId) >= 0;
    if (isPilot) {
      log.push(`${CardTitle(pending.upgradeCardId)} is piloting ${CardTitle(targetUnit.cardId)}.`);
    } else {
      log.push(`${CardTitle(pending.upgradeCardId)} attached to ${CardTitle(targetUnit.cardId)}.`);
    }

    // SOR_061 / LOF_058 Guardian of the Whills: mark first-upgrade-used for this round.
    // Only the guardian's controller benefits from the discount, so only their attachment consumes it.
    if ((targetUnit.cardId === "SOR_061" || targetUnit.cardId === "LOF_058")
        && pending.player === targetUnit.controller
        && !game.currentEffects.some(e => e.cardId === "SOR_061_firstUpgradeUsed" && e.targetPlayId === targetUnit.playId && e.affectedPlayer === pending.player)) {
      game.currentEffects.push({ cardId: "SOR_061_firstUpgradeUsed", duration: "Round", affectedPlayer: pending.player, targetPlayId: targetUnit.playId });
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

    // SOR_053 Luke's Lightsaber: When Played — if attached unit is Luke Skywalker, heal all damage and give Shield.
    if (pending.upgradeCardId === "SOR_053") {
      if (CardTitle(targetUnit.cardId) === "Luke Skywalker") {
        targetUnit.damage = 0;
        targetUnit.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game), owner: targetUnit.owner, controller: targetUnit.controller });
        log.push(`Luke's Lightsaber: healed all damage from ${CardTitle(targetUnit.cardId)} and gave a Shield token.`);
      }
    }

    // SOR_136 Vader's Lightsaber: When Played — if attached unit is Darth Vader, may deal 4 damage to a ground unit.
    if (pending.upgradeCardId === "SOR_136") {
      if (CardTitle(targetUnit.cardId) === "Darth Vader") {
        const groundUnits136 = [...game.player1.groundArena, ...game.player2.groundArena];
        if (groundUnits136.length > 0) {
          const vadersLightsaberPending: AbilityOptionPending = {
            type: "ability-option",
            cardId: "SOR_136",
            helperText: "Deal 4 damage to a ground unit?",
            yesLabel: "Deal 4",
            noLabel: "Skip",
            onYes: {
              type: "ability-target",
              cardId: "SOR_136",
              player: pending.player,
              fromPlayIds: groundUnits136.map(u => u.playId),
              continuation: null,
            } satisfies AbilityTargetPending,
            continuation: null,
          };
          updateDefeatedPlayers(game);
          return { response: resolutionResponse(pendingToResolution(vadersLightsaberPending, game)), pending: vadersLightsaberPending, stateChanged: true };
        }
      }
    }

    // Snapshot Reflexes: When Played — may attack with attached unit if it's ready.
    if (pending.upgradeCardId === "SOR_215" || pending.upgradeCardId === "SHD_223") {
      if (targetUnit.ready) {
        const snapPending: AbilityOptionPending = {
          type: "ability-option",
          cardId: pending.upgradeCardId,
          helperText: `Attack with ${CardTitle(targetUnit.cardId)}?`,
          yesLabel: "Attack",
          noLabel: "Skip",
          onYes: {
            type: "attack-target",
            attackerPlayId: targetUnit.playId,
            source: pending.upgradeCardId,
            continuation: null,
          },
          continuation: null,
        };
        updateDefeatedPlayers(game);
        return { response: resolutionResponse(pendingToResolution(snapPending, game)), pending: snapPending, stateChanged: true };
      }
    }

    updateDefeatedPlayers(game);
    // Drain any reactions queued by playing this upgrade (e.g. SHD_018 The Mandalorian, or an
    // opponent's SHD_172 Krayt Dragon reacting to the upgrade being played).
    const bagAfterUpgrade = drainTriggerBag(game, log);
    if (bagAfterUpgrade) {
      return { response: resolutionResponse(pendingToResolution(bagAfterUpgrade, game)), pending: bagAfterUpgrade, stateChanged: false };
    }
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
      const unit = GetUnitByPlayId(game, playId);
      if (unit) defeatForExploit(game, log, unit);
    }

    // Cost = fullCost − 2 per defeated unit, minimum 0
    const reducedCost = Math.max(0, pending.fullCost - chosen.length * 2);
    const readyCount = spendableFor(game, pending.playingPlayer);
    if (readyCount < reducedCost) {
      // Shouldn't normally happen (we validated before offering Exploit), but guard anyway
      return { response: invalidResponse(`Not enough resources after Exploit reduction.`), pending, stateChanged: false };
    }

    // Consume the Exploit current-effect by calling ExploitAmount in consume mode
    ExploitAmount(pending.cardId, "hand", pending.playingPlayer, false);

    payResources(game, pending.playingPlayer, reducedCost, log, pending.cardId);
    log.push(`Player ${pending.playingPlayer} played ${CardTitle(pending.cardId)} using Exploit (defeated ${chosen.length} unit(s), cost reduced by ${chosen.length * 2}).`);
    return completePlayCard(game, log, pending.cardId, pending.playingPlayer);
  }

  if (pending.type === "play-from-hand") {
    const idx = data.targetIndices?.[0];
    if (idx == null)
      return { response: invalidResponse("Choose a card from hand to play."), pending, stateChanged: false };
    const hand = GetPlayer(game, pending.player).hand;
    if (idx < 0 || idx >= hand.length)
      return { response: invalidResponse("Invalid hand index."), pending, stateChanged: false };
    const cardId = hand[idx].cardId;

    switch (pending.cardId) {
      case "SOR_129": { // Admiral Ozzel — play an Imperial unit at normal cost, enters ready.
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Admiral Ozzel: chosen card is not a Unit."), pending, stateChanged: false };
        if (!CardTraits(cardId).includes("Imperial"))
          return { response: invalidResponse("Admiral Ozzel: chosen unit is not Imperial."), pending, stateChanged: false };
        const cost129 = playCost(game, pending.player, cardId);
        const ready129 = spendableFor(game, pending.player);
        if (ready129 < cost129)
          return { response: invalidResponse("Not enough resources to play this unit."), pending, stateChanged: false };
        payResources(game, pending.player, cost129, log, cardId);
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId)} via Admiral Ozzel (enters ready).`);
        const result129 = completePlayCard(game, log, cardId, pending.player, { enterReady: true });
        // After playing: each opponent may ready a unit.
        const oppPlayer129: PlayerId = pending.player === 1 ? 2 : 1;
        const oppUnits129 = GetUnitsForPlayer(oppPlayer129);
        const ozzelContinuation: AbilityOptionPending = {
          type: "ability-option",
          cardId: "SOR_129",
          player: oppPlayer129,
          helperText: `Opponent: ready a unit?`,
          yesLabel: "Ready a unit",
          noLabel: "No",
          onYes: oppUnits129.length > 0 ? {
            type: "ability-target",
            cardId: "SOR_129_ready",
            player: oppPlayer129,
            fromPlayIds: oppUnits129.map(u => u.playId),
            continuation: result129.pending ?? null,
          } satisfies AbilityTargetPending : result129.pending ?? null,
          continuation: result129.pending ?? null,
        };
        return { response: resolutionResponse(pendingToResolution(ozzelContinuation, game)), pending: ozzelContinuation, stateChanged: false };
      }
      case "SOR_093": { // Alliance Dispatcher — play a unit from hand at -1 cost
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Alliance Dispatcher: chosen card is not a Unit."), pending, stateChanged: false };
        const cost093 = Math.max(0, playCost(game, pending.player, cardId) - 1);
        const ready093 = spendableFor(game, pending.player);
        if (ready093 < cost093)
          return { response: invalidResponse("Not enough resources to play this unit."), pending, stateChanged: false };
        payResources(game, pending.player, cost093, log, cardId);
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId)} via Alliance Dispatcher (-1 cost).`);
        return completePlayCard(game, log, cardId, pending.player);
      }
      case "SOR_022": {
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("ECL: chosen card is not a Unit."), pending, stateChanged: false };
        if ((CardCost(cardId) ?? 0) > 6)
          return { response: invalidResponse("ECL: chosen unit costs more than 6."), pending, stateChanged: false };
        const eclCost = playCost(game, pending.player, cardId);
        const eclReady = spendableFor(game, pending.player);
        if (eclReady < eclCost)
          return { response: invalidResponse("ECL: not enough resources to play this unit."), pending, stateChanged: false };
        payResources(game, pending.player, eclCost, log, cardId);
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId) ?? cardId} via Energy Conversion Lab.`);
        return completePlayCard(game, log, cardId, pending.player, {
          injectEffect: { cardId: "SOR_022", duration: "Phase", affectedPlayer: pending.player },
        });
      }
      case "SHD_129": {
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Timely Intervention: chosen card is not a Unit."), pending, stateChanged: false };
        const tiCost = playCost(game, pending.player, cardId);
        const tiReady = spendableFor(game, pending.player);
        if (tiReady < tiCost)
          return { response: invalidResponse("Timely Intervention: not enough resources to play this unit."), pending, stateChanged: false };
        payResources(game, pending.player, tiCost, log, cardId);
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId) ?? cardId} via Timely Intervention.`);
        return completePlayCard(game, log, cardId, pending.player, {
          injectEffect: { cardId: "SHD_129", duration: "Phase", affectedPlayer: pending.player },
        });
      }
      case "TWI_005": {
        if (!TraitContains(cardId, "Separatist"))
          return { response: invalidResponse("Dooku: chosen card is not a Separatist card."), pending, stateChanged: false };
        const fullCost = playCost(game, pending.player, cardId);
        const cardExploit = ExploitAmount(cardId, undefined, undefined, true);
        const totalExploit = cardExploit + 1;
        const dookuReady = spendableFor(game, pending.player);
        const minCost = Math.max(0, fullCost - totalExploit * 2);
        if (dookuReady < minCost)
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
      case "SEC_062": { // Bardottan Ornithopter disclose: reveal must have Vigilance
        if (!CardsCanDisclose([cardId], ["Vigilance"]))
          return { response: invalidResponse("Disclose: revealed card does not have a Vigilance aspect."), pending, stateChanged: false };
        log.push(`${CardTitle(pending.cardId)}: disclosed ${CardTitle(cardId)} (Vigilance).`);
        DrawCardForPlayer(game, log, pending.player);
        const bag062 = drainTriggerBag(game, log);
        if (bag062) return { response: resolutionResponse(pendingToResolution(bag062, game)), pending: bag062, stateChanged: true };
        return { response: stateResponse(game), pending: null, stateChanged: true };
      }
      case "SEC_181": { // Unauthorized Investigation disclose: reveal must have Aggression
        if (!CardsCanDisclose([cardId], ["Aggression"]))
          return { response: invalidResponse("Disclose: revealed card does not have an Aggression aspect."), pending, stateChanged: false };
        log.push(`${CardTitle(pending.cardId)}: disclosed ${CardTitle(cardId)} (Aggression).`);
        CreateSpy(game, pending.player, log, pending.cardId);
        const bag181 = drainTriggerBag(game, log);
        if (bag181) return { response: resolutionResponse(pendingToResolution(bag181, game)), pending: bag181, stateChanged: true };
        return { response: stateResponse(game), pending: null, stateChanged: true };
      }
      case "SEC_182": { // Charged with Treason disclose pick 1: count Aggression icons
        if (!CardsCanDisclose([cardId], ["Aggression"]))
          return { response: invalidResponse("Disclose: revealed card does not have an Aggression aspect."), pending, stateChanged: false };
        const aggrCount = CardAspects(cardId).filter(a => a === "Aggression").length;
        log.push(`${CardTitle(pending.cardId)}: disclosed ${CardTitle(cardId)} (Aggression ×${aggrCount}).`);
        if (aggrCount >= 2) {
          // Requirement met — proceed to damage targeting
          const allUnits182 = [...game.player1.groundArena, ...game.player1.spaceArena, ...game.player2.groundArena, ...game.player2.spaceArena];
          if (allUnits182.length === 0) return { response: stateResponse(game), pending: null, stateChanged: true };
          const dmgPending: AbilityTargetPending = { type: "ability-target", cardId: "SEC_182", player: pending.player, fromPlayIds: allUnits182.map(u => u.playId), continuation: null };
          return { response: resolutionResponse(pendingToResolution(dmgPending, game)), pending: dmgPending, stateChanged: false };
        }
        // Only 1 Aggression — need one more card
        const needsMore: PlayFromHandPending = { type: "play-from-hand", cardId: "SEC_182_2", player: pending.player };
        return { response: resolutionResponse(pendingToResolution(needsMore, game)), pending: needsMore, stateChanged: false };
      }
      case "SEC_182_2": { // Charged with Treason disclose pick 2: need 1 more Aggression
        if (!CardsCanDisclose([cardId], ["Aggression"]))
          return { response: invalidResponse("Disclose: revealed card does not have an Aggression aspect."), pending, stateChanged: false };
        log.push(`${CardTitle("SEC_182")}: disclosed ${CardTitle(cardId)} (Aggression) — requirement met.`);
        const allUnits182b = [...game.player1.groundArena, ...game.player1.spaceArena, ...game.player2.groundArena, ...game.player2.spaceArena];
        if (allUnits182b.length === 0) return { response: stateResponse(game), pending: null, stateChanged: true };
        const dmgPending2: AbilityTargetPending = { type: "ability-target", cardId: "SEC_182", player: pending.player, fromPlayIds: allUnits182b.map(u => u.playId), continuation: null };
        return { response: resolutionResponse(pendingToResolution(dmgPending2, game)), pending: dmgPending2, stateChanged: false };
      }
      case "SOR_176":
      case "SEC_184": {
        if (CardType(cardId) !== "Event")
          return { response: invalidResponse("ISB Agent: chosen card is not an Event."), pending, stateChanged: false };
        log.push(`${CardTitle(pending.cardId)}: revealed ${CardTitle(cardId) ?? cardId}.`);
        const allUnitsIsb = [
          ...game.player1.groundArena, ...game.player1.spaceArena,
          ...game.player2.groundArena, ...game.player2.spaceArena,
        ];
        if (allUnitsIsb.length === 0)
          return { response: stateResponse(game), pending: null, stateChanged: true };
        const isbPending: AbilityTargetPending = {
          type: "ability-target",
          cardId: pending.cardId,
          player: pending.player,
          fromPlayIds: allUnitsIsb.map(u => u.playId),
          continuation: null,
        };
        return { response: resolutionResponse(pendingToResolution(isbPending, game)), pending: isbPending, stateChanged: false };
      }
      case "SOR_235": { // Galactic Ambition — play a non-Heroism unit for free; deal its cost to own base.
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Galactic Ambition: chosen card is not a Unit."), pending, stateChanged: false };
        if (CardAspects(cardId).includes("Heroism"))
          return { response: invalidResponse("Galactic Ambition: chosen unit cannot have the Heroism aspect."), pending, stateChanged: false };
        const baseCost235 = CardCost(cardId) ?? 0;
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId)} via Galactic Ambition (free).`);
        const result235 = completePlayCard(game, log, cardId, pending.player);
        GetPlayer(game, pending.player).base.damage += baseCost235;
        log.push(`${CardTitle("SOR_235")}: dealt ${baseCost235} damage to Player ${pending.player}'s base.`);
        return result235;
      }
      case "SOR_219": {
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Sneak Attack: chosen card is not a Unit."), pending, stateChanged: false };
        const fullCost219 = playCost(game, pending.player, cardId);
        const reducedCost219 = Math.max(0, fullCost219 - 3);
        const ready219 = spendableFor(game, pending.player);
        if (ready219 < reducedCost219)
          return { response: invalidResponse("Sneak Attack: not enough resources to play this unit."), pending, stateChanged: false };
        payResources(game, pending.player, reducedCost219, log, cardId);
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId)} via Sneak Attack (cost reduced by 3, enters ready).`);
        return completePlayCard(game, log, cardId, pending.player, {
          enterReady: true,
          injectEffect: { cardId: "SOR_219", duration: "UntilStartOfRegroup", affectedPlayer: pending.player },
        });
      }
      default:
        return { response: invalidResponse(`Unknown play-from-hand source: ${pending.cardId}`), pending, stateChanged: false };
    }
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
      const unit = GetUnitByPlayId(game, assignment.playId);
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

  if (pending.type === "indirect-damage") {
    const basePlayId = `player${pending.targetPlayer}.base`;
    const assignments = data.spreadDamageAssignments ?? [];
    const baseDamage = assignments.find(a => a.playId === basePlayId)?.damage ?? 0;
    const unitAssignments = assignments.filter(a => a.playId !== basePlayId && a.damage > 0);

    const invalidUnit = unitAssignments.find(a => !pending.eligibleUnitPlayIds.includes(a.playId));
    if (invalidUnit)
      return { response: invalidResponse(`Unit ${invalidUnit.playId} is not eligible for indirect damage.`), pending, stateChanged: false };

    const total = unitAssignments.reduce((sum, a) => sum + a.damage, 0) + baseDamage;
    if (total !== pending.totalDamage)
      return { response: invalidResponse(`Must assign exactly ${pending.totalDamage} indirect damage (got ${total}).`), pending, stateChanged: false };

    // Per-unit cap: cannot assign more than remaining HP (CR 8.36.3)
    for (const a of unitAssignments) {
      const unit = GetUnitByPlayId(game, a.playId);
      if (!unit) continue;
      const remaining = Unit.FromInterface(unit).CurrentHP();
      if (a.damage > remaining)
        return { response: invalidResponse(`Cannot assign more than ${remaining} indirect damage to ${CardTitle(unit.cardId)}.`), pending, stateChanged: false };
    }

    // Apply unit damage — shields are NOT removed (CR 8.36.2)
    for (const a of unitAssignments) {
      const unit = GetUnitByPlayId(game, a.playId);
      if (unit) unit.damage += a.damage;
    }

    // Apply base damage
    const targetState = pending.targetPlayer === 1 ? game.player1 : game.player2;
    if (baseDamage > 0) {
      targetState.base.damage += baseDamage;
      game.roundState.baseDamagedThisPhase.push({ byPlayer: pending.sourcePlayer, target: pending.targetPlayer });
    }

    log.push(`${CardTitle(pending.cardId)}: ${pending.totalDamage} indirect damage assigned by player ${pending.targetPlayer}.`);
    updateDefeatedPlayers(game);
    const afterSweepI = sweepDeadUnits(game, log, pending.continuation ?? null);
    if (afterSweepI) {
      if (afterSweepI.type === "resolve-attack") return handleResolveAttack(game, log, afterSweepI);
      return { response: resolutionResponse(pendingToResolution(afterSweepI, game)), pending: afterSweepI, stateChanged: true };
    }
    const bagI = drainTriggerBag(game, log);
    if (bagI) return { response: resolutionResponse(pendingToResolution(bagI, game)), pending: bagI, stateChanged: true };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "spread-heal") {
    const assignments = (data.spreadDamageAssignments ?? []).filter(a => a.damage > 0);
    const total = assignments.reduce((sum, a) => sum + a.damage, 0);

    if (total > pending.maxHeal)
      return { response: invalidResponse(`Cannot heal more than ${pending.maxHeal} total damage.`), pending, stateChanged: false };

    for (const assignment of assignments) {
      if (!pending.eligiblePlayIds.includes(assignment.playId))
        return { response: invalidResponse(`${assignment.playId} is not an eligible heal target.`), pending, stateChanged: false };
      const baseMatch = assignment.playId.match(/^player([12])\.base$/);
      if (baseMatch) {
        const pNum = Number(baseMatch[1]) as PlayerId;
        const pState = GetPlayer(game, pNum);
        if (assignment.damage > pState.base.damage)
          return { response: invalidResponse(`Cannot heal more than ${pState.base.damage} damage from player ${pNum}'s base.`), pending, stateChanged: false };
      } else {
        const unit = GetUnitByPlayId(game, assignment.playId);
        if (unit && assignment.damage > unit.damage)
          return { response: invalidResponse(`Cannot heal more than ${unit.damage} damage from ${CardTitle(unit.cardId)}.`), pending, stateChanged: false };
      }
    }

    for (const assignment of assignments) {
      healTarget(game, assignment.playId, assignment.damage, log, pending.cardId);
    }

    let nextPending: PendingResolution | null = pending.continuation;
    if (pending.afterHeal && total > 0) {
      const effect = pending.afterHeal;
      if (effect.type === "deal-healed-to-self") {
        DealDamageToUnit(game, pending.cardId, effect.targetPlayId, total, log);
      } else { // "deal-healed-to-unit"
        nextPending = {
          type: "spread-damage",
          cardId: pending.cardId,
          player: pending.player,
          totalDamage: total,
          eligiblePlayIds: effect.eligiblePlayIds,
          optional: effect.optional,
          continuation: pending.continuation,
        } satisfies SpreadDamagePending;
      }
    }

    updateDefeatedPlayers(game);
    const afterSweepH = sweepDeadUnits(game, log, nextPending);
    if (afterSweepH) {
      if (afterSweepH.type === "resolve-attack") return handleResolveAttack(game, log, afterSweepH);
      return { response: resolutionResponse(pendingToResolution(afterSweepH, game)), pending: afterSweepH, stateChanged: true };
    }
    const bagH = drainTriggerBag(game, log);
    if (bagH) return { response: resolutionResponse(pendingToResolution(bagH, game)), pending: bagH, stateChanged: true };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "deck-search") {
    const chosen = data.targetPlayIds ?? [];
    const eligibleMap = new Map(pending.eligibleChoices.map(c => [c.tempId, c]));

    for (const id of chosen) {
      if (!eligibleMap.has(id))
        return { response: invalidResponse(`Deck search: unknown selection "${id}".`), pending, stateChanged: false };
    }
    if (pending.maxCombinedCost) {
      const combinedCost = chosen.reduce((sum, id) => sum + eligibleMap.get(id)!.cost, 0);
      if (combinedCost > pending.maxCombinedCost)
        return { response: invalidResponse(`Deck search: combined cost ${combinedCost} exceeds ${pending.maxCombinedCost}.`), pending, stateChanged: false };
    }
    // Remove the top N cards from the deck — all actions share this first step.
    const pState = GetPlayer(game, pending.player);
    pState.deck.splice(pState.deck.length - pending.topCards.length, pending.topCards.length);
    const takenSet = new Set(chosen);

    // "scry": chosen = top cards in player-chosen order (first = topmost); unchosen go to bottom in random order.
    if (pending.action === "scry") {
      const bottomCards = pending.topCards.filter(c => !takenSet.has(c.tempId)).map(c => ({ cardId: c.cardId }));
      for (let i = bottomCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bottomCards[i], bottomCards[j]] = [bottomCards[j], bottomCards[i]];
      }
      // Push top cards in reverse so the first chosen ends up topmost (last pushed = top of deck)
      const topCards = chosen.map(id => ({ cardId: eligibleMap.get(id)!.cardId }));
      pState.deck.unshift(...bottomCards);
      pState.deck.push(...[...topCards].reverse());
      if (topCards.length > 0) {
        log.push(`${CardTitle(pending.cardId)}: put ${topCards.length} card(s) on top, ${bottomCards.length} on the bottom.`);
      } else {
        log.push(`${CardTitle(pending.cardId)}: put all ${bottomCards.length} card(s) on the bottom.`);
      }
      const contBottom = pending.continuation ?? null;
      if (contBottom) return { response: resolutionResponse(pendingToResolution(contBottom, game)), pending: contBottom, stateChanged: true };
      const bagBottom = drainTriggerBag(game, log);
      if (bagBottom) return { response: resolutionResponse(pendingToResolution(bagBottom, game)), pending: bagBottom, stateChanged: true };
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    // For "draw" and "play": unchosen cards go to the bottom in random order.
    const unchosenCards = pending.topCards.filter(c => !takenSet.has(c.tempId)).map(c => ({ cardId: c.cardId }));
    for (let i = unchosenCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unchosenCards[i], unchosenCards[j]] = [unchosenCards[j], unchosenCards[i]];
    }

    pState.deck.unshift(...unchosenCards);

    if (chosen.length === 0) {
      log.push(`${CardTitle(pending.cardId)}: no cards selected. ${unchosenCards.length} card(s) returned to the bottom of deck.`);
      const contNone = pending.continuation ?? null;
      if (contNone) return { response: resolutionResponse(pendingToResolution(contNone, game)), pending: contNone, stateChanged: false };
      const bagNone = drainTriggerBag(game, log);
      if (bagNone) return { response: resolutionResponse(pendingToResolution(bagNone, game)), pending: bagNone, stateChanged: false };
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    log.push(`${CardTitle(pending.cardId)}: ${unchosenCards.length} card(s) returned to the bottom of deck.`);

    if (pending.action === "draw") {
      const drawnTitles: string[] = [];
      for (const tempId of chosen) {
        const choice = eligibleMap.get(tempId)!;
        pState.hand.push({ cardId: choice.cardId });
        drawnTitles.push(CardTitle(choice.cardId) ?? choice.cardId);
      }
      log.push(`${CardTitle(pending.cardId)}: drew ${drawnTitles.join(", ")}.`);
      const contDraw = pending.continuation ?? null;
      if (contDraw) return { response: resolutionResponse(pendingToResolution(contDraw, game)), pending: contDraw, stateChanged: false };
      const bagDraw = drainTriggerBag(game, log);
      if (bagDraw) return { response: resolutionResponse(pendingToResolution(bagDraw, game)), pending: bagDraw, stateChanged: false };
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    // action === "play": enter each chosen unit into the arena (exhausted), queue triggers
    for (const tempId of chosen) {
      addUnitFromSearch(game, log, eligibleMap.get(tempId)!.cardId, pending.player, pending.costModifier);
    }
    updateDefeatedPlayers(game);
    const contPlay = pending.continuation ?? null;

    // Uniqueness must interrupt before the entered units' queued triggers drain. If two
    // copies of a unique card entered at once (e.g. two R2-D2 via U-Wing Reinforcement),
    // prompt to defeat one; the entered units' When Played fires afterward via the bag.
    const uniqueSearchPending = uniquenessDefeatPending(game, pending.player);
    if (uniqueSearchPending) {
      uniqueSearchPending.continuation = contPlay;
      return { response: resolutionResponse(pendingToResolution(uniqueSearchPending, game)), pending: uniqueSearchPending, stateChanged: true };
    }

    const bagPlay = drainTriggerBag(game, log);
    if (bagPlay) {
      const chained = contPlay ? injectContinuation(bagPlay, contPlay) : bagPlay;
      return { response: resolutionResponse(pendingToResolution(chained, game)), pending: chained, stateChanged: true };
    }
    if (contPlay) return { response: resolutionResponse(pendingToResolution(contPlay, game)), pending: contPlay, stateChanged: true };
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending.type === "reveal-discard") {
    const chosen = new Set(data.targetPlayIds ?? []);
    const cardMap = new Map(pending.revealedCards.map(c => [c.tempId, c]));

    for (const id of chosen) {
      if (!cardMap.has(id))
        return { response: invalidResponse(`Reveal-discard: unknown selection "${id}".`), pending, stateChanged: false };
    }

    const pState = GetPlayer(game, pending.player);
    const discarded = pending.revealedCards.filter(c => chosen.has(c.tempId));
    const returned = pending.revealedCards.filter(c => !chosen.has(c.tempId));

    for (const c of discarded) {
      pState.discard.push({ cardId: c.cardId, playId: String(game.nextPlayId++), owner: pending.player, controller: pending.player, turnDiscarded: game.currentRound, discardEffect: "" });
    }
    pState.deck.push(...returned.map(c => ({ cardId: c.cardId })));

    if (discarded.length > 0) {
      log.push(`${CardTitle(pending.cardId)}: discarded ${discarded.length} card(s), returned ${returned.length} to top of deck.`);
    } else {
      log.push(`${CardTitle(pending.cardId)}: returned all ${returned.length} card(s) to top of deck.`);
    }

    updateDefeatedPlayers(game);
    const cont = pending.continuation ?? null;
    if (cont) return { response: resolutionResponse(pendingToResolution(cont, game)), pending: cont, stateChanged: true };
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
  switch (trigger.cardId) {
    case "saboteur": {
      if (cont.target.type === "unit") {
        const def = GetUnitByPlayId(game, cont.target.playId);
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
    case "SHD_126": {
      applyDarksaberOnAttack(attacker);
      return cont;
    }
    case "SHD_177": {
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
        yesLabel: "Deal Damage",
        noLabel: "Skip",
        onYes: spreadPending,
        continuation: cont,
      };
    }
    case "SOR_121": {
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
        yesLabel: "Deal Damage",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "SOR_121",
          fromPlayIds: arenaUnits121.map(u => u.playId),
          continuation: cont,
        },
        continuation: cont,
      };
    }
    case "LAW_238": { // Scavenging Sandcrawler native On Attack (resolved as a single chosen trigger)
      const discard238 = GetPlayer(game, attacker.controller).discard;
      if (discard238.length === 0) return cont;
      return {
        type: "ability-option",
        cardId: "LAW_238",
        player: attacker.controller,
        helperText: "Put a card from your discard pile on the bottom of your deck and create a Credit token?",
        yesLabel: "Yes",
        noLabel: "Skip",
        onYes: {
          type: "return-from-discard",
          cardId: "LAW_238",
          player: attacker.controller,
          maxCount: 1,
          eligiblePlayIds: discard238.map(d => d.playId),
          continuation: cont,
        },
        continuation: cont,
      };
    }
    case "SEC_264": { // Clandestine Connections upgrade On Attack (resolved as a single chosen trigger)
      if (spendableFor(game, attacker.controller) < 2) return cont;
      return {
        type: "ability-option",
        cardId: "SEC_264",
        player: attacker.controller,
        sourcePlayId: attacker.playId,
        helperText: "Pay 2 to deal 2 damage to a base?",
        yesLabel: "Pay 2",
        noLabel: "Skip",
        onYes: null,
        continuation: cont,
      };
    }
    default:
      return resolveOnAttackTrigger(attacker, cont, { skipOrderingPrompt: true });
  }
}

function thrawnsReveal(game: GameState, log: string[], deckOwner: PlayerId, thrawnPlayer: PlayerId): PendingResolution | null {
  const deck = GetPlayer(game, deckOwner).deck;
  if (deck.length === 0) {
    log.push(`${CardTitle("SOR_016")}: Player ${deckOwner}'s deck is empty — no card to reveal.`);
    return null;
  }
  const topCard = deck[deck.length - 1];
  const revealedCost = CardCost(topCard.cardId) ?? 0;
  const subtitle = CardSubtitle(topCard.cardId);
  const cardLabel = subtitle ? `${CardTitle(topCard.cardId)} — ${subtitle}` : CardTitle(topCard.cardId);
  log.push(`${CardTitle("SOR_016")}: revealed ${cardLabel} (cost ${revealedCost}) from Player ${deckOwner}'s deck.`);
  const eligible = GetAllUnits(game).filter(u => (CardCost(u.cardId) ?? 0) <= revealedCost);
  if (eligible.length === 0) return null;
  return {
    type: "ability-target",
    cardId: "SOR_016",
    player: thrawnPlayer,
    fromPlayIds: eligible.map(u => u.playId),
    continuation: null,
  } satisfies AbilityTargetPending;
}

function applyAbilityOptionEffect(
  pending: AbilityOptionPending,
  game: GameState,
  log: string[],
): PendingResolution | null {
  switch (pending.cardId) {
    case "LOF_017": { // Darth Revan — (front: exhaust the leader), then give an Experience token to the attacking unit.
      const attacker017 = GetUnitByPlayId(game, pending.sourcePlayId!);
      const leader017 = GetLeaderForPlayer(pending.player!);
      if (!leader017.deployed) leader017.ready = false; // pay the "exhaust this leader" cost (front side)
      if (attacker017) {
        attacker017.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: attacker017.owner, controller: attacker017.controller });
        log.push(`${CardTitle("LOF_017")}: gave an Experience token to ${CardTitle(attacker017.cardId)}.`);
      }
      return pending.continuation ?? null;
    }
    case "SHD_014": { // Cad Bane — (front: exhaust the leader; deployed: mark once-per-round used,) then the opponent chooses their unit to take damage.
      const leaderC = GetLeaderForPlayer(pending.player!);
      if (!leaderC.deployed) leaderC.ready = false; // front side: exhausting the leader is the cost
      const oppC = GetOtherPlayer(pending.player!);
      const oppUnitsC = GetUnitsForPlayer(oppC);
      if (oppUnitsC.length === 0) return pending.continuation ?? null;
      if (leaderC.deployed) {
        game.currentEffects.push({ cardId: "SHD_014_usedThisRound", duration: "Round", affectedPlayer: pending.player! });
      }
      return {
        type: "ability-target",
        cardId: "SHD_014",
        player: oppC, // "an opponent chooses a unit they control"
        amount: leaderC.deployed ? 2 : 1,
        fromPlayIds: oppUnitsC.map(u => u.playId),
        continuation: pending.continuation ?? null,
      };
    }
    case "TWI_018": { // Quinlan Vos — (front: exhaust the leader,) then choose an eligible-cost enemy unit to damage.
      const leaderQ = GetLeaderForPlayer(pending.player!);
      if (!leaderQ.deployed) leaderQ.ready = false; // front side: exhausting the leader is the cost
      const costQ = pending.amount ?? 0;
      const oppQ = GetOtherPlayer(pending.player!);
      const eligibleQ = GetUnitsForPlayer(oppQ).filter(u =>
        leaderQ.deployed ? (CardCost(u.cardId) ?? 0) <= costQ : (CardCost(u.cardId) ?? 0) === costQ);
      if (eligibleQ.length === 0) return pending.continuation ?? null;
      return {
        type: "ability-target",
        cardId: "TWI_018",
        player: pending.player!,
        fromPlayIds: eligibleQ.map(u => u.playId),
        continuation: pending.continuation ?? null,
      };
    }
    case "SHD_018": { // The Mandalorian — (front: exhaust the leader,) then exhaust an enemy unit within the HP threshold.
      const leader018 = GetLeaderForPlayer(pending.player!);
      if (!leader018.deployed) leader018.ready = false; // front side: exhausting the leader is the cost
      const threshold018 = leader018.deployed ? 6 : 4;
      const opp018 = GetOtherPlayer(pending.player!);
      const eligible018 = GetUnitsForPlayer(opp018).filter(u => u.CurrentHP() <= threshold018);
      if (eligible018.length === 0) return pending.continuation ?? null;
      return {
        type: "ability-target",
        cardId: "SHD_018",
        player: pending.player!,
        fromPlayIds: eligible018.map(u => u.playId),
        continuation: pending.continuation ?? null,
      };
    }
    case "LOF_075": // Cure Wounds — Use the Force, then heal 6 from a unit.
    case "LOF_172": { // Sorcerous Blast — Use the Force, then deal 3 to a unit.
      const forcePlayer = pending.player!;
      if (!UseTheForce(forcePlayer, log, pending.cardId)) return pending.continuation ?? null;
      return {
        type: "ability-target",
        cardId: pending.cardId,
        player: forcePlayer,
        fromPlayIds: GetAllUnits(game).map(u => u.playId),
        continuation: pending.continuation ?? null,
      };
    }
    case "SEC_264": { // Clandestine Connections Yes — pay 2, then deal 2 to a base
      const unit264 = GetUnitByPlayId(game, pending.sourcePlayId!);
      const player264 = unit264 ? unit264.controller : pending.player!;
      payResources(game, player264, 2, log, "SEC_264");
      log.push(`${CardTitle("SEC_264")}: paid 2.`);
      return sec264BaseTargetPending(player264, 2, pending.continuation ?? null);
    }
    case "LAW_233": { // Galen Erso Yes — an opponent takes control of Galen
      const owner233 = pending.player!;
      const opponent233: PlayerId = owner233 === 1 ? 2 : 1;
      const galen233 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (galen233) transferControl(game, log, galen233, opponent233);
      return pending.continuation ?? null;
    }
    case "ASH_229": { // Camtono Yes — play the top card of the deck for free
      const player229 = pending.player!;
      const pState229 = GetPlayer(game, player229);
      const top229 = pState229.deck.pop();
      if (!top229) return pending.continuation ?? null;
      log.push(`${CardTitle("ASH_229")}: playing ${CardTitle(top229.cardId)} for free.`);
      const result229 = completePlayCard(game, log, top229.cardId, player229);
      if (result229.pending) return injectContinuation(result229.pending, pending.continuation ?? null);
      return pending.continuation ?? null;
    }
    case "SOR_119": { // Reinforcement Walker Yes — draw the top card
      const pState119 = GetPlayer(game, pending.player!);
      const top119 = pState119.deck.pop();
      if (top119) {
        pState119.hand.push({ cardId: top119.cardId });
        log.push(`${CardTitle(pending.cardId)}: drew ${CardTitle(top119.cardId)}.`);
      }
      return pending.continuation ?? null;
    }
    case "SOR_147": { // Black One Yes — discard hand, draw 3
      const pState147 = pending.player === 1 ? game.player1 : game.player2;
      const discarded147 = pState147.hand.splice(0);
      for (const c of discarded147) {
        pState147.discard.unshift({ cardId: c.cardId, playId: String(game.nextPlayId++), owner: pending.player!, controller: pending.player!, turnDiscarded: game.currentRound, discardEffect: "" });
      }
      DrawCardForPlayer(game, log, pending.player!);
      DrawCardForPlayer(game, log, pending.player!);
      DrawCardForPlayer(game, log, pending.player!);
      log.push(`${CardTitle("SOR_147")}: discarded hand and drew 3 cards.`);
      return pending.continuation ?? null;
    }
    case "SOR_083": // Superlaser Technician Yes (SOR_083 / SHD_085 reprint) — remove from discard, put into resources ready
    case "SHD_085": {
      const pState083 = GetPlayer(game, pending.player!);
      const discardIdx083 = pState083.discard.findIndex(d => d.playId === pending.sourcePlayId);
      const playId083 = discardIdx083 >= 0
        ? pState083.discard.splice(discardIdx083, 1)[0].playId
        : nextPlayId(game);
      pState083.resources.push({
        cardId: pending.cardId,
        playId: playId083,
        owner: pending.player!,
        controller: pending.player!,
        ready: true,
        stolen: false,
      });
      log.push(`${CardTitle(pending.cardId)}: entered play as a ready resource.`);
      return pending.continuation ?? null;
    }
    case "SOR_016": // Yes = reveal own deck
      return thrawnsReveal(game, log, pending.player!, pending.player!);
    case "JTL_096": {
      const unit = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (unit) {
        payResources(game, unit.controller, 2, log, "JTL_096");
        const pState = GetPlayer(game, unit.controller);
        const spaceIdx = pState.spaceArena.findIndex(u => u.playId === unit.playId);
        if (spaceIdx !== -1) {
          pState.spaceArena.splice(spaceIdx, 1);
          pState.groundArena.push(unit);
        }
        unit.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: unit.owner, controller: unit.controller });
        unit.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: unit.owner, controller: unit.controller });
        log.push(`${CardTitle(unit.cardId)} moved to the ground arena and gained 2 Experience tokens.`);
      }
      return pending.continuation ?? null;
    }
    case "JTL_049": {
      const unit = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (!unit) return pending.continuation ?? null;
      const eligible = l337EligibleVehicles(game, unit.controller, pending.sourcePlayId!);
      if (eligible.length === 0) return pending.continuation ?? null;
      return {
        type: "ability-target",
        cardId: "JTL_049",
        player: unit.controller,
        sourcePlayId: pending.sourcePlayId,
        fromPlayIds: eligible,
        continuation: pending.continuation ?? null,
      } satisfies AbilityTargetPending;
    }
    case "SOR_233": { // I Am Your Father Yes — deal 7 damage to the targeted unit.
      if (pending.sourcePlayId) {
        DealDamageToUnit(game, "I Am Your Father", pending.sourcePlayId, 7, log);
        updateDefeatedPlayers(game);
      }
      return pending.continuation ?? null;
    }
    case "SOR_105": { // General Krell — granted "When Defeated: You may draw a card."
      DrawCardForPlayer(game, log, pending.player!);
      log.push(`${CardTitle("SOR_105")}: drew a card.`);
      return pending.continuation ?? null;
    }
    case "SOR_045": { // Yoda When Defeated Yes: controller draws a card, then ask opponent.
      DrawCardForPlayer(game, log, pending.player!);
      log.push(`${CardTitle("SOR_045")}: Player ${pending.player!} drew a card.`);
      return pending.continuation ?? null;
    }
    case "SOR_045_opp": { // Yoda When Defeated Yes (second prompt): opponent draws a card.
      const opp045 = pending.player === 1 ? 2 : 1;
      DrawCardForPlayer(game, log, opp045);
      log.push(`${CardTitle("SOR_045")}: Player ${opp045} drew a card.`);
      return pending.continuation ?? null;
    }
    case "SOR_171": { // Mission Briefing Yes: playing player draws 2 cards.
      DrawCardForPlayer(game, log, pending.player!);
      DrawCardForPlayer(game, log, pending.player!);
      return pending.continuation ?? null;
    }
    case "SOR_173": { // Bombing Run Yes: deal 3 to each ground unit.
      for (const u of [...game.player1.groundArena, ...game.player2.groundArena]) {
        u.damage += 3;
      }
      log.push(`${CardTitle("SOR_173")}: dealt 3 damage to each ground unit.`);
      updateDefeatedPlayers(game);
      return pending.continuation ?? null;
    }
    case "SOR_067": { // Rugged Survivors Yes: draw a card.
      DrawCardForPlayer(game, log, pending.player!);
      log.push(`${CardTitle("SOR_067")}: drew a card.`);
      return pending.continuation ?? null;
    }
    case "SOR_206": { // Mining Guild TIE Yes: pay 2 resources, draw a card.
      const unit206 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (unit206) {
        payResources(game, unit206.controller, 2, log, "SOR_206");
        DrawCardForPlayer(game, log, unit206.controller);
        log.push(`${CardTitle("SOR_206")}: paid 2 resources and drew a card.`);
      }
      return pending.continuation ?? null;
    }
    case "SOR_221": { // Outmaneuver Yes: exhaust each ground unit.
      for (const u of [...game.player1.groundArena, ...game.player2.groundArena]) {
        u.ready = false;
      }
      log.push(`${CardTitle("SOR_221")}: exhausted all ground units.`);
      return pending.continuation ?? null;
    }
    case "SOR_193": { // Millennium Falcon Yes: pay 1 resource
      const player193 = pending.player!;
      const pState193 = GetPlayer(game, player193);
      const readyResource193 = pState193.resources.find(r => r.ready);
      if (readyResource193) {
        readyResource193.ready = false;
        log.push(`${CardTitle("SOR_193")}: paid 1 resource to keep it in play.`);
      }
      return pending.continuation ?? null;
    }
    case "SOR_192": { // Ezra Bridger Yes: play the top card
      const player192 = pending.player!;
      const pState192 = GetPlayer(game, player192);
      const topCard192 = pState192.deck.pop();
      if (!topCard192) return pending.continuation ?? null;
      const cost192 = playCost(game, player192, topCard192.cardId);
      payResources(game, player192, cost192, log, "SOR_192");
      log.push(`${CardTitle("SOR_192")}: playing ${CardTitle(topCard192.cardId)} from top of deck.`);
      const result192 = completePlayCard(game, log, topCard192.cardId, player192);
      return result192.pending;
    }
    case "SOR_192_discard": { // Ezra Bridger: discard top card
      const player192d = pending.player!;
      const pState192d = GetPlayer(game, player192d);
      const topCard192d = pState192d.deck.pop();
      if (!topCard192d) return pending.continuation ?? null;
      pushEventToDiscard(game, player192d, topCard192d.cardId);
      log.push(`${CardTitle("SOR_192")}: discarded ${CardTitle(topCard192d.cardId)}.`);
      return pending.continuation ?? null;
    }
    default:
      return pending.continuation ?? null;
  }
}

function applyAbilityOptionDeclineEffect(
  pending: AbilityOptionPending,
  game: GameState,
  log: string[],
): PendingResolution | null {
  switch (pending.cardId) {
    case "SOR_119": { // Reinforcement Walker No — discard top card and heal 3 from base
      const pState119No = GetPlayer(game, pending.player!);
      const top119No = pState119No.deck.pop();
      if (top119No) {
        pushEventToDiscard(game, pending.player!, top119No.cardId);
        log.push(`${CardTitle(pending.cardId)}: discarded ${CardTitle(top119No.cardId)}.`);
        pState119No.base.damage = Math.max(0, pState119No.base.damage - 3);
        log.push(`${CardTitle(pending.cardId)}: healed 3 damage from player ${pending.player!}'s base.`);
      }
      return pending.continuation;
    }
    case "SOR_088": // Declined — discard stored excess value
      game.currentEffects = game.currentEffects.filter(e => e.cardId !== "SOR_088_excess");
      return pending.continuation;
    case "SOR_016": // No = reveal opponent's deck
      return thrawnsReveal(game, log, GetOtherPlayer(pending.player!), pending.player!);
    case "JTL_049": {
      const l337Unit = GetUnitByPlayId(game, pending.sourcePlayId!);
      let nextPending: PendingResolution | null = pending.continuation ?? null;
      if (l337Unit) {
        const defeatPending = defeatUnit(game, log, l337Unit, true);
        if (defeatPending) {
          type WithContinuation = { continuation?: PendingResolution | null };
          let tail: WithContinuation = defeatPending as unknown as WithContinuation;
          while (tail.continuation != null) tail = tail.continuation as unknown as WithContinuation;
          tail.continuation = nextPending;
          nextPending = defeatPending;
        }
      }
      updateDefeatedPlayers(game);
      return nextPending;
    }
    case "SOR_233": { // I Am Your Father No — casting player (the other player) draws 3 cards.
      const caster233 = GetOtherPlayer(pending.player!);
      DrawCardForPlayer(game, log, caster233);
      DrawCardForPlayer(game, log, caster233);
      DrawCardForPlayer(game, log, caster233);
      log.push(`${CardTitle("SOR_233")}: opponent said no — Player ${caster233} draws 3 cards.`);
      return pending.continuation ?? null;
    }
    case "SOR_171": { // Mission Briefing No: opponent draws 2 cards.
      const opp171 = pending.player === 1 ? 2 : 1;
      DrawCardForPlayer(game, log, opp171);
      DrawCardForPlayer(game, log, opp171);
      return pending.continuation ?? null;
    }
    case "SOR_173": { // Bombing Run No: deal 3 to each space unit.
      for (const u of [...game.player1.spaceArena, ...game.player2.spaceArena]) {
        u.damage += 3;
      }
      log.push(`${CardTitle("SOR_173")}: dealt 3 damage to each space unit.`);
      updateDefeatedPlayers(game);
      return pending.continuation ?? null;
    }
    case "SOR_221": { // Outmaneuver No: exhaust each space unit.
      for (const u of [...game.player1.spaceArena, ...game.player2.spaceArena]) {
        u.ready = false;
      }
      log.push(`${CardTitle("SOR_221")}: exhausted all space units.`);
      return pending.continuation ?? null;
    }
    case "SOR_193": { // Millennium Falcon No: return to owner's hand
      const player193d = pending.player!;
      const mfUnit193 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (mfUnit193) {
        removeFromArena(game, pending.sourcePlayId!);
        GetPlayer(game, player193d).hand.push({ cardId: "SOR_193" });
        log.push(`${CardTitle("SOR_193")}: returned to Player ${player193d}'s hand.`);
      }
      return pending.continuation ?? null;
    }
    default:
      return pending.continuation ?? null;
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
      let nextPending = pending.onYes ?? null;
      if (nextPending?.type === "mill") {
        nextPending = processMill(game, log, nextPending);
      }
      if (nextPending) {
        return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: true };
      }
      // onYes is null — apply inline effect by cardId
      const effectResult = applyAbilityOptionEffect(pending, game, log);
      if (effectResult?.type === "resolve-attack") return handleResolveAttack(game, log, effectResult);
      if (effectResult) return { response: resolutionResponse(pendingToResolution(effectResult, game)), pending: effectResult, stateChanged: false };
      const bagPendingYes = drainTriggerBag(game, log);
      if (bagPendingYes) {
        return { response: resolutionResponse(pendingToResolution(bagPendingYes, game)), pending: bagPendingYes, stateChanged: false };
      }
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }
    // "No" — apply decline effect
    const nextPending = applyAbilityOptionDeclineEffect(pending, game, log);
    if (nextPending?.type === "resolve-attack") {
      return handleResolveAttack(game, log, nextPending);
    }
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    const bagPendingNo = drainTriggerBag(game, log);
    if (bagPendingNo) {
      return { response: resolutionResponse(pendingToResolution(bagPendingNo, game)), pending: bagPendingNo, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  if (pending?.type === "credit-payment-option") {
    if (option !== "Yes" && option !== "No") {
      return { response: invalidResponse(`Unknown option: ${option}`), pending, stateChanged: false };
    }
    // "No" defeats only what the player is forced to (usually nothing).
    if (option === "No") {
      return replayWithCredits(game, pending, pending.minForced);
    }
    // "Yes" with only one possible amount auto-spends it; otherwise ask how many.
    if (pending.maxUseful === pending.minForced + 1) {
      return replayWithCredits(game, pending, pending.maxUseful);
    }
    const amountPending: CreditPaymentAmountPending = { ...pending, type: "credit-payment-amount" };
    return { response: resolutionResponse(pendingToResolution(amountPending, game)), pending: amountPending, stateChanged: false };
  }

  if (pending?.type === "credit-payment-amount") {
    const n = parseInt(option, 10);
    if (Number.isNaN(n) || n < pending.minForced || n > pending.maxUseful) {
      return { response: invalidResponse(`Choose between ${pending.minForced} and ${pending.maxUseful} Credit(s).`), pending, stateChanged: false };
    }
    return replayWithCredits(game, pending, n);
  }

  if (pending?.type === "choose-indirect-target") {
    const targetPlayer: PlayerId = option === "Yourself" ? pending.sourcePlayer : (pending.sourcePlayer === 1 ? 2 : 1);
    const targetState = targetPlayer === 1 ? game.player1 : game.player2;
    const eligibleUnits = [...targetState.groundArena, ...targetState.spaceArena].map(u => u.playId);
    const indirectPending: IndirectDamagePending = {
      type: "indirect-damage",
      cardId: pending.cardId,
      sourcePlayer: pending.sourcePlayer,
      targetPlayer,
      totalDamage: pending.totalDamage,
      eligibleUnitPlayIds: eligibleUnits,
      continuation: null,
    };
    return { response: resolutionResponse(pendingToResolution(indirectPending, game)), pending: indirectPending, stateChanged: false };
  }

  if (pending?.type === "on-attack-order") {
    const attacker = GetUnitByPlayId(game, pending.attackerPlayId) as Unit | null;
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

    switch (chosen.cardId) {
      case "saboteur": {
        // Strip defender's shields now
        if (pending.continuation.target.type === "unit") {
          const defender = GetUnitByPlayId(game, pending.continuation.target.playId);
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
      case "SHD_126": {
        // Auto: give XP to other friendly Mandalorian units
        applyDarksaberOnAttack(attacker);
        return returnPending(buildRemaining(pending.continuation), pending.continuation);
      }
      case "SHD_177": {
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
      case "SOR_121": {
        // Resolve the native on-attack trigger with remaining triggers as the new continuation
        const afterNative = buildRemaining(pending.continuation);
        const nativeCont = (afterNative ?? pending.continuation) as ResolveAttackPending;
        const nativePending = resolveOnAttackTrigger(attacker, nativeCont, { skipOrderingPrompt: true });
        return returnPending(nativePending, pending.continuation);
      }
      default: {
        // Resolve the *chosen* trigger specifically (not "the first one found"), with the
        // remaining triggers chained as its continuation so each resolves exactly once.
        const afterChosen = buildRemaining(pending.continuation);
        const chosenCont = (afterChosen ?? pending.continuation) as ResolveAttackPending;
        const chosenPending = processSingleOnAttackTrigger(chosen, attacker, chosenCont, game, log);
        return returnPending(chosenPending, pending.continuation);
      }
    }
  }

  if (pending?.type === "trigger-player-order") {
    // CR 7.6.10 — active player chose which player's stack resolves first.
    if (option !== "Mine" && option !== "Theirs") {
      return { response: invalidResponse(`Unknown option: ${option}`), pending, stateChanged: false };
    }
    game.triggerBatchPlayer = option === "Mine" ? pending.activePlayer : GetOtherPlayer(pending.activePlayer);
    const nextPending = drainTriggerBag(game, log);
    if (nextPending) {
      return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
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

  if (pending?.type === "choose-one") {
    if (!pending.options.some(o => o.id === option)) {
      return { response: invalidResponse(`Unknown option: ${option}`), pending, stateChanged: false };
    }
    const chosen = resolveChooseOne(game, log, pending, option);
    if (chosen) {
      return { response: resolutionResponse(pendingToResolution(chosen, game)), pending: chosen, stateChanged: false };
    }
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
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
      // An empty target hand makes this pending unsatisfiable; skipUnsatisfiableDiscards
      // in processDispatch resolves that centrally, for every card that forces a discard.
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
      GetPlayer(game, owner).resources.push({
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
      switch (pending.cardId) {
        case "SHD_027": {
          DrawCardForPlayer(game, log, pending.collectingPlayer);
          const nextPending = pending.continuation ?? null;
          updateDefeatedPlayers(game);
          if (nextPending) {
            return { response: resolutionResponse(pendingToResolution(nextPending, game)), pending: nextPending, stateChanged: false };
          }
          return { response: stateResponse(game), pending: null, stateChanged: true };
        }
        case "SHD_068": {
          const allUnits = [...game.player1.groundArena, ...game.player1.spaceArena,
                            ...game.player2.groundArena, ...game.player2.spaceArena];
          const eligiblePlayIds = allUnits
            .filter(u => u.controller === pending.collectingPlayer)
            .map(u => u.playId);
          const shieldPending: AbilityTargetPending = {
            type: "ability-target",
            cardId: "SHD_068",
            player: pending.collectingPlayer,
            fromPlayIds: eligiblePlayIds,
            continuation: pending.continuation ?? null,
          };
          return { response: resolutionResponse(pendingToResolution(shieldPending, game)), pending: shieldPending, stateChanged: false };
        }
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
      const readyCount = spendableFor(game, pending.playingPlayer);
      if (readyCount < pending.fullCost) {
        // Can't afford without Exploit — return card to hand
        GetPlayer(game, pending.playingPlayer).hand.push({ cardId: pending.cardId });
        return { response: invalidResponse("Cannot afford this card without using Exploit."), pending: null, stateChanged: false };
      }
      payResources(game, pending.playingPlayer, pending.fullCost, log, pending.cardId);
      log.push(`Player ${pending.playingPlayer} played ${CardTitle(pending.cardId)} (Exploit declined).`);
      return completePlayCard(game, log, pending.cardId, pending.playingPlayer);
    }
    // "Yes" — prompt player to choose up to exploitAmount friendly units to defeat
    if (option === "Yes") {
      const friendlyUnits = [
        ...GetPlayer(game, pending.playingPlayer).groundArena,
        ...GetPlayer(game, pending.playingPlayer).spaceArena,
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

  if (pending?.type === "bamboozle-alt-cost") {
    if (option === "Yes") {
      log.push(`Player ${pending.playingPlayer} is playing ${CardTitle("SOR_199")} (alternate cost).`);
      const discardPending: BamboozleAltCostDiscardPending = {
        type: "bamboozle-alt-cost-discard",
        playingPlayer: pending.playingPlayer,
        eligibleHandIndices: pending.cunningHandIndices,
      };
      return { response: resolutionResponse(pendingToResolution(discardPending, game)), pending: discardPending, stateChanged: false };
    }
    // "No" — pay normal cost; return card to hand if they can't afford it.
    const readyNow = spendableFor(game, pending.playingPlayer);
    if (readyNow < pending.fullCost) {
      GetPlayer(game, pending.playingPlayer).hand.push({ cardId: "SOR_199" });
      return { response: invalidResponse("Cannot afford Bamboozle without using alternate cost."), pending: null, stateChanged: false };
    }
    payResources(game, pending.playingPlayer, pending.fullCost, log, "SOR_199");
    log.push(`Player ${pending.playingPlayer} played ${CardTitle("SOR_199")} (normal cost).`);
    return completePlayCard(game, log, "SOR_199", pending.playingPlayer);
  }

  if (pending?.type === "piloting-option" && pending.source === "hand") {
    if (option === "Play as Unit") {
      payResources(game, pending.playingPlayer, pending.unitCost, log, pending.cardId);
      log.push(`Player ${pending.playingPlayer} played ${CardTitle(pending.cardId)} as a unit.`);
      return completePlayCard(game, log, pending.cardId, pending.playingPlayer);
    }
    if (option === "Play as Pilot") {
      payResources(game, pending.playingPlayer, pending.pilotingCost, log, pending.cardId);
      log.push(`Player ${pending.playingPlayer} is playing ${CardTitle(pending.cardId)} as a Pilot.`);
      game.roundState.cardsPlayedThisRound.push({ fromPlayer: pending.playingPlayer, cardId: pending.cardId, playId: "", playedAs: "Pilot" });
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
    const leader = GetPlayer(game, pending.playingPlayer).leader;
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

  if (pending?.type === "dont-get-cocky") {
    const deck223 = GetPlayer(game, pending.player).deck;
    const revealedCards223 = [...pending.revealedCards];

    const finalizeDontGetCocky = (): HandlerResult => {
      const totalCost = revealedCards223.reduce((sum, c) => sum + c.cost, 0);
      if (totalCost <= 7) {
        const target223 = GetUnitByPlayId(game, pending.targetPlayId);
        if (target223) {
          DealDamageToUnit(game, "SOR_223", target223.playId, totalCost, log);
          log.push(`${CardTitle("SOR_223")}: dealt ${totalCost} damage to ${CardTitle(target223.cardId)}.`);
        }
      } else {
        log.push(`${CardTitle("SOR_223")}: combined cost ${totalCost} exceeds 7 — no damage dealt.`);
      }
      // Shuffle revealed cards to deck bottom in random order
      const shuffled = [...revealedCards223].sort(() => Math.random() - 0.5);
      for (const card of shuffled) {
        deck223.unshift({ cardId: card.cardId });
      }
      log.push(`${CardTitle("SOR_223")}: revealed cards placed on the bottom of deck in random order.`);
      const sweepPend = sweepDeadUnits(game, log, null);
      updateDefeatedPlayers(game);
      if (sweepPend) return { response: resolutionResponse(pendingToResolution(sweepPend, game)), pending: sweepPend, stateChanged: false };
      const bagPend = drainTriggerBag(game, log);
      if (bagPend) return { response: resolutionResponse(pendingToResolution(bagPend, game)), pending: bagPend, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    };

    if (option === "Reveal") {
      if (deck223.length === 0 || revealedCards223.length >= 7) {
        return finalizeDontGetCocky();
      }
      const card223 = deck223.pop()!;
      revealedCards223.push({ tempId: String(revealedCards223.length), cardId: card223.cardId, cost: CardCost(card223.cardId) ?? 0 });
      const canRevealMore = deck223.length > 0 && revealedCards223.length < 7;
      if (!canRevealMore) {
        return finalizeDontGetCocky();
      }
      const updatedPending223: DontGetCockyPending = { ...pending, revealedCards: revealedCards223 };
      return { response: resolutionResponse(pendingToResolution(updatedPending223, game)), pending: updatedPending223, stateChanged: false };
    }

    if (option === "Stop") {
      return finalizeDontGetCocky();
    }

    return { response: invalidResponse("Invalid option for Don't Get Cocky."), pending, stateChanged: false };
  }

  // ---------------------------------------------------------------------------
  // "Choose two, in any order" aspect event handler (SOR_058/107/155/203)
  // ---------------------------------------------------------------------------
  if (pending?.type === "choose-aspect-effect") {
    if (!pending.remainingEffects.includes(option)) {
      return { response: invalidResponse(`Unknown effect: ${option}`), pending, stateChanged: false };
    }

    const remaining = pending.remainingEffects.filter(e => e !== option);
    const isFirstPick = pending.remainingEffects.length === 4;
    const nextContinuation: PendingResolution | null = isFirstPick
      ? { type: "choose-aspect-effect", cardId: pending.cardId, player: pending.player, remainingEffects: remaining, continuation: pending.continuation }
      : pending.continuation;

    const effectResult = buildAspectEffect(game, log, pending.cardId, pending.player, option, nextContinuation);

    if (!effectResult) {
      const bagAsp = drainTriggerBag(game, log);
      if (nextContinuation) return { response: resolutionResponse(pendingToResolution(nextContinuation, game)), pending: nextContinuation, stateChanged: true };
      if (bagAsp) return { response: resolutionResponse(pendingToResolution(bagAsp, game)), pending: bagAsp, stateChanged: true };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    if (effectResult.type === "mill") {
      const afterMill = processMill(game, log, effectResult);
      if (!afterMill) {
        const bagAfterMill = drainTriggerBag(game, log);
        if (bagAfterMill) return { response: resolutionResponse(pendingToResolution(bagAfterMill, game)), pending: bagAfterMill, stateChanged: true };
        return { response: stateResponse(game), pending: null, stateChanged: true };
      }
      return { response: resolutionResponse(pendingToResolution(afterMill, game)), pending: afterMill, stateChanged: true };
    }

    return { response: resolutionResponse(pendingToResolution(effectResult, game)), pending: effectResult, stateChanged: false };
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
  return GetPlayer(game, player).resources
    .filter(r => HasPlot(r.cardId) && canAfford(game, player, r.cardId))
    .map(r => r.playId);
}

function leaderHasWhenDeployed(cardId: string): boolean {
  switch (cardId) {
    case "SHD_002": return true;
    case "LAW_008": return true;
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

/**
 * Leaders whose Epic Action deploys "If you control N resources…" (or a related count)
 * rather than by paying their deploy cost. Returns whether the condition is met, or null
 * if the leader deploys normally (by paying).
 */
function LeaderEpicDeployCondition(game: GameState, player: PlayerId, cardId: string): boolean | null {
  const p = GetPlayer(game, player);
  switch (cardId) {
    case "LOF_003": // Ahsoka Tano — If you control 6 or more resources.
      return p.resources.length >= 6;
    case "LOF_017": // Darth Revan — If you control 5 or more resources.
    case "TWI_018": // Quinlan Vos — If you control 5 or more resources.
      return p.resources.length >= 5;
    case "SHD_014": // Cad Bane — If you control 6 or more resources.
    case "SHD_018": // The Mandalorian — If you control 6 or more resources.
      return p.resources.length >= 6;
    case "LOF_007": // Avar Kriss — If resources + times Used the Force this phase >= 9.
      return p.resources.length + game.roundState.forceUsedThisPhase >= 9;
    default:
      return null;
  }
}

function deployLeader(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const leader = GetPlayer(game, player).leader;
  if (leader.deployed)
    return { response: invalidResponse("Leader is already deployed."), pending: null, stateChanged: false };
  if (leader.epicActionUsed)
    return { response: invalidResponse("Leader epic action already used this round."), pending: null, stateChanged: false };

  // Some LOF/ASH leaders deploy via a condition ("If you control N resources…") instead of
  // paying their deploy cost. For those, gate on the condition and pay nothing.
  const epicCondition = LeaderEpicDeployCondition(game, player, leader.cardId);
  let deployCost = 0;
  if (epicCondition !== null) {
    if (!epicCondition)
      return { response: invalidResponse("Epic Action deploy condition not met."), pending: null, stateChanged: false };
  } else {
    deployCost = playCost(game, player, leader.cardId);
    if (GetPlayer(game, player).resources.length < deployCost)
      return { response: invalidResponse("Not enough resources to deploy leader."), pending: null, stateChanged: false };
  }

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
  const nested = game.triggerBag.length > 0;
  if (HasShielded(leader.cardId, unit.playId, player)) {
    game.triggerBag.push({ triggerType: "shielded", cardId: leader.cardId, fromPlayer: player, playId: unit.playId, nested });
  }

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
  const triggerPending = drainTriggerBag(game, log);
  if (triggerPending) {
    return { response: resolutionResponse(pendingToResolution(triggerPending, game)), pending: triggerPending, stateChanged: true };
  }
  return { response: stateResponse(game), pending: null, stateChanged: true };
}

function resolveLeaderAbility(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const leader = GetPlayer(game, player).leader;
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
    case "SOR_002": { // Iden Versio — Action [Exhaust]: If an enemy unit was defeated this phase, heal 1 damage from your base.
      const otherPlayer002: PlayerId = player === 1 ? 2 : 1;
      if (!UnitWasDefeatedThisPhase(otherPlayer002)) {
        log.push(`${CardTitle("SOR_002")}: no enemy unit defeated this phase — soft pass.`);
        return null;
      }
      const base002 = GetPlayer(game, player).base;
      base002.damage = Math.max(0, base002.damage - 1);
      log.push(`${CardTitle("SOR_002")}: healed 1 damage from your base.`);
      return null;
    }
    case "LOF_007": { // Avar Kriss — Action [Exhaust]: The Force is with you (create your Force token).
      CreateForceToken(player, log, "LOF_007");
      return null;
    }
    case "LOF_003": { // Ahsoka Tano — Action [Exhaust, use the Force]: Give a friendly unit Sentinel this phase.
      if (!UseTheForce(player, log, "LOF_003")) return null;
      const friendly003 = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena];
      if (friendly003.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LOF_003",
        player,
        fromPlayIds: friendly003.map(u => u.playId),
        continuation: null,
      };
    }
    case "TWI_005": { // Count Dooku — Action [Exhaust]: Play a Separatist card from your hand. It gains Exploit 1.
      const separatistInHand = GetPlayer(game, player).hand.some(c => CardTraits(c.cardId).includes("Separatist"));
      if (!separatistInHand) {
        log.push(`${CardTitle("TWI_005")}: no Separatist cards in hand.`);
        return null;
      }
      return { type: "play-from-hand", cardId: "TWI_005", player } satisfies PlayFromHandPending;
    }
    case "SOR_006": { // Emperor Palpatine - Galactic Ruler: Action [1 Resource, Exhaust, defeat a friendly unit]: Deal 1 damage to a unit and draw a card.
      const friendlyUnits006 = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena];
      if (friendlyUnits006.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_006",
        player,
        fromPlayIds: friendlyUnits006.map(u => u.playId),
        continuation: null,
      };
    }
    case "LAW_008": { // Director Krennic — Action [Exhaust, defeat a friendly unit]: Create a Credit token.
      const friendly008 = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena];
      if (friendly008.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LAW_008_action",
        player,
        fromPlayIds: friendly008.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "SOR_016": { // Grand Admiral Thrawn: Reveal top card of any player's deck. Exhaust a unit that costs ≤ that card.
      return {
        type: "ability-option",
        cardId: "SOR_016",
        player,
        helperText: "Reveal the top card of which deck?",
        yesLabel: "Yourself",
        noLabel: "Opponent",
        onYes: null,
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "SOR_014": // Sabine Wren - Galvanized Revolutionary: Deal 1 damage to each base.
      game.player1.base.damage += 1;
      game.player2.base.damage += 1;
      log.push(`${CardTitle(cardId)} dealt 1 damage to each base.`);
      return null;
    case "TWI_012": { // Anakin Skywalker — Action [Exhaust, deal 2 damage to your base]: Attack with a unit. +2/+0 if attacking a unit.
      GetPlayer(game, player).base.damage += 2;
      log.push(`${CardTitle("TWI_012")}: dealt 2 damage to your base.`);
      const readyUnits012 = GetUnitsForPlayer(player).filter(u => u.ready);
      if (readyUnits012.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "TWI_012",
        player,
        fromPlayIds: readyUnits012.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "SEC_006": { // Colonel Yularen — Action [Exhaust]: Attack with a unit. Then, you may attack with another unit that costs less than it.
      const readyUnits006 = GetUnitsForPlayer(player).filter(u => u.ready);
      if (readyUnits006.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SEC_006",
        player,
        fromPlayIds: readyUnits006.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
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
    case "SHD_028": { // Doctor Pershing — Action [Exhaust, deal 1 damage to a friendly unit]: Draw a card.
      const friendly028 = GetUnitsForPlayer(player);
      if (friendly028.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SHD_028",
        player,
        fromPlayIds: friendly028.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_110": { // Frontline Shuttle — Action [defeat this unit]: Attack with a unit, even if exhausted.
      if (!playId) return null;
      const shuttle110 = GetUnitByPlayId(game, playId);
      if (!shuttle110) return null;
      defeatUnit(game, log, shuttle110);
      log.push(`${CardTitle("SOR_110")}: defeated as the action cost.`);
      const friendlySpace110 = GetPlayer(game, player).spaceArena as Unit[];
      if (friendlySpace110.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_110",
        player,
        fromPlayIds: friendlySpace110.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "SOR_129": // Admiral Ozzel — Action [Exhaust]: Play an Imperial unit from hand, it enters ready.
      return { type: "play-from-hand", cardId, player } satisfies PlayFromHandPending;
    case "SOR_093": // Alliance Dispatcher — Action [Exhaust]: Play a unit from hand at -1 cost.
      return { type: "play-from-hand", cardId, player } satisfies PlayFromHandPending;
    case "SOR_094": { // Bail Organa — Action [Exhaust]: Give an Experience token to another friendly unit.
      const others094 = GetUnitsForPlayer(player).filter(u => u.playId !== playId);
      if (others094.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: others094.map(u => u.playId),
        continuation: null,
      };
    }
    case "LOF_246": { // Grogu — Action [Exhaust]: Heal up to 2 from a unit. If you do, deal that much to a unit.
      const allUnits246 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)].map(u => u.playId);
      return {
        type: "spread-heal",
        cardId: "LOF_246",
        player,
        maxHeal: 2,
        eligiblePlayIds: allUnits246,
        afterHeal: { type: "deal-healed-to-unit", eligiblePlayIds: allUnits246, optional: false },
        continuation: null,
      } satisfies SpreadHealPending;
    }
    default:
      return null;
  }
}

/**
 * Executes a MillPending inline — moves cards from deck to discard and
/**
 * Builds the first PendingResolution for a chosen aspect-event effect.
 * Auto-resolving effects are applied inline and return the next continuation.
 * Returns null when the effect is auto-resolved AND there is no continuation.
 */
function buildAspectEffect(
  game: GameState,
  log: string[],
  cardId: string,
  player: PlayerId,
  effect: string,
  continuation: PendingResolution | null,
): PendingResolution | null {
  const opp = GetOtherPlayer(player);
  const allUnits = GetAllUnits(game);

  switch (effect) {
    // ── SOR_058 Vigilance ───────────────────────────────────────────────────
    case "mill_6_opponent_deck":
      return { type: "mill", cardId, player, millingPlayer: opp, count: 6, continuation };

    case "heal_5_base":
      return {
        type: "ability-target",
        cardId: "SOR_058_heal_5_base",
        player,
        fromPlayIds: ["player1.base", "player2.base"],
        continuation,
      };

    case "defeat_unit_3hp": {
      const eligible058 = allUnits.filter(u => Unit.FromInterface(u).CurrentHP() <= 3);
      if (eligible058.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_058_defeat_unit_3hp",
        player,
        fromPlayIds: eligible058.map(u => u.playId),
        continuation,
      };
    }

    case "give_shield": {
      if (allUnits.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_058_give_shield",
        player,
        fromPlayIds: allUnits.map(u => u.playId),
        continuation,
      };
    }

    // ── SOR_107 Command ─────────────────────────────────────────────────────
    case "give_2_xp": {
      if (allUnits.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_107_give_2_xp",
        player,
        fromPlayIds: allUnits.map(u => u.playId),
        continuation,
      };
    }

    case "power_damage_enemy": {
      const friendly107 = GetAllUnits(game).filter(u => u.controller === player);
      if (friendly107.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_107_STEP1",
        player,
        fromPlayIds: friendly107.map(u => u.playId),
        continuation,
      };
    }

    case "play_as_resource": {
      GetPlayer(game, player).resources.push({
        cardId,
        playId: nextPlayId(game),
        owner: player,
        controller: player,
        ready: true,
        stolen: false,
      });
      log.push(`${CardTitle(cardId)}: put into play as a resource.`);
      return continuation;
    }

    case "return_from_discard": {
      const unitDiscard107 = GetPlayer(game, player).discard.filter(d => CardType(d.cardId) === "Unit");
      if (unitDiscard107.length === 0) return continuation;
      return {
        type: "return-from-discard",
        cardId,
        player,
        maxCount: 1,
        eligiblePlayIds: unitDiscard107.map(d => d.playId),
        continuation,
      };
    }

    // ── SOR_155 Aggression ──────────────────────────────────────────────────
    case "draw_card":
      DrawCardForPlayer(game, log, player);
      log.push(`${CardTitle(cardId)}: drew a card.`);
      return continuation;

    case "defeat_upgrades": {
      const upgradePlayIds155 = allUnits.flatMap(u => u.upgrades.map(upg => upg.playId));
      if (upgradePlayIds155.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_155_defeat_upgrades",
        player,
        fromPlayIds: upgradePlayIds155,
        needsMultiple: true,
        maxTargets: 2,
        continuation,
      };
    }

    case "ready_unit_3pow": {
      const eligible155 = allUnits.filter(u => Unit.FromInterface(u).CurrentPower() <= 3);
      if (eligible155.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_155_ready_unit_3pow",
        player,
        fromPlayIds: eligible155.map(u => u.playId),
        continuation,
      };
    }

    case "deal_4_damage": {
      if (allUnits.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_155_deal_4_damage",
        player,
        fromPlayIds: allUnits.map(u => u.playId),
        continuation,
      };
    }

    // ── SOR_203 Cunning ─────────────────────────────────────────────────────
    case "bounce_unit_4pow": {
      const eligible203 = allUnits.filter(u => !CardIsLeader(u.cardId) && Unit.FromInterface(u).CurrentPower() <= 4);
      if (eligible203.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_203_bounce_unit",
        player,
        fromPlayIds: eligible203.map(u => u.playId),
        continuation,
      };
    }

    case "buff_4_attack": {
      if (allUnits.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_203_buff_4_attack",
        player,
        fromPlayIds: allUnits.map(u => u.playId),
        continuation,
      };
    }

    case "exhaust_2_units": {
      if (allUnits.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "SOR_203_exhaust_2",
        player,
        fromPlayIds: allUnits.map(u => u.playId),
        needsMultiple: true,
        maxTargets: 2,
        continuation,
      };
    }

    case "random_discard": {
      const oppHand = GetPlayer(game, opp).hand;
      if (oppHand.length > 0) {
        const idx = Math.floor(Math.random() * oppHand.length);
        const [discarded] = oppHand.splice(idx, 1);
        pushEventToDiscard(game, opp, discarded.cardId);
        log.push(`${CardTitle(cardId)}: opponent discarded ${CardTitle(discarded.cardId)} at random.`);
      }
      return continuation;
    }

    default:
      return continuation;
  }
}

/**
 * returns a MillResultPending so card-specific post-mill effects are applied
 * in processMillResult rather than here.
 */
function processMill(game: GameState, log: string[], pending: MillPending): PendingResolution | null {
  const pState = GetPlayer(game, pending.millingPlayer);
  const milledCardIds: string[] = [];

  for (let i = 0; i < pending.count; i++) {
    const top = pState.deck.pop();
    if (!top) break;
    pushEventToDiscard(game, pending.millingPlayer, top.cardId);
    log.push(`${CardTitle(pending.cardId)}: milled ${CardTitle(top.cardId)}.`);
    milledCardIds.push(top.cardId);
  }

  return processMillResult(game, log, {
    type: "mill-result",
    cardId: pending.cardId,
    player: pending.player,
    milledCardIds,
    continuation: pending.continuation ?? null,
  });
}

/**
 * Applies card-specific post-mill effects given the set of cards that were milled.
 * Processed inline — no client round-trip unless the effect itself requires targeting.
 */
function processMillResult(game: GameState, log: string[], pending: MillResultPending): PendingResolution | null {
  switch (pending.cardId) {
    case "SOR_204": { // Greedo — if any non-unit was milled, deal 2 damage to a ground unit
      const nonUnitMilled = pending.milledCardIds.some((id: string) => CardType(id) !== "Unit");
      if (nonUnitMilled) {
        const groundUnits = AllGroundUnits();
        if (groundUnits.length > 0) {
          return {
            type: "ability-target",
            cardId: pending.cardId,
            player: pending.player,
            fromPlayIds: groundUnits.map(u => u.playId),
            continuation: pending.continuation,
          } satisfies AbilityTargetPending;
        }
      }
      break;
    }
    case "SOR_188": { // Chopper — if the milled card is an event, exhaust one of the defender's ready resources.
      const eventMilled188 = pending.milledCardIds.some(id => CardType(id) === "Event");
      if (eventMilled188) {
        const defenderState188 = GetPlayer(game, pending.player === 1 ? 2 : 1);
        const readyResource188 = defenderState188.resources.find(r => r.ready);
        if (readyResource188) {
          readyResource188.ready = false;
          log.push(`${CardTitle(pending.cardId)}: milled an event — exhausted a resource from the defending player.`);
        }
      }
      break;
    }
    case "SOR_047": { // Kanan Jarrus — heal base by number of distinct aspects among milled cards
      const distinctAspects = new Set(pending.milledCardIds.flatMap((id: string) => CardAspects(id)));
      const healAmount = distinctAspects.size;
      if (healAmount > 0) {
        const healPlayer = GetPlayer(game, pending.player);
        healPlayer.base.damage = Math.max(0, healPlayer.base.damage - healAmount);
        log.push(`${CardTitle(pending.cardId)}: healed ${healAmount} damage from player ${pending.player}'s base (${healAmount} distinct aspect(s)).`);
      }
      break;
    }
  }
  return pending.continuation;
}

/**
 * Heals `amount` damage from the target identified by `targetPlayId`.
 * Accepts unit play IDs as well as the base identifiers "player1.base" / "player2.base".
 */
function healTarget(
  game: GameState,
  targetPlayId: string,
  amount: number,
  log: string[],
  sourceCardId: string,
): void {
  const baseMatch = targetPlayId.match(/^player([12])\.base$/);
  if (baseMatch) {
    const playerNum = Number(baseMatch[1]) as PlayerId;
    const playerState = GetPlayer(game, playerNum);
    playerState.base.damage = Math.max(0, playerState.base.damage - amount);
    log.push(`${CardTitle(sourceCardId)}: healed ${amount} damage from player ${playerNum}'s base.`);
  } else {
    const unit = GetUnitByPlayId(game, targetPlayId);
    if (unit) {
      unit.damage = Math.max(0, unit.damage - amount);
      log.push(`${CardTitle(sourceCardId)}: healed ${amount} damage from ${CardTitle(unit.cardId)}.`);
    }
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
    case "SOR_062": { // Regional Governor — store the named card title on the governor unit.
      if (!targetPlayId) break;
      const gs062 = game.currentGameState;
      const governor = GetUnitByPlayId(gs062, pending.sourcePlayId!);
      if (governor) {
        governor.namedCardTitle = CardTitle(targetPlayId) || targetPlayId;
        game.gameLog.push(`Regional Governor: named "${governor.namedCardTitle}" — opponents can't play it while Regional Governor is in play.`);
      }
      break;
    }
    case "SOR_074": // Repair — Heal 3 damage from a unit or base.
    case "JTL_075": {
      if (!targetPlayId) break;
      healTarget(game.currentGameState, targetPlayId, 3, game.gameLog, pending.cardId);
      break;
    }
    case "SOR_033": //Death Trooper: Deal 2 damage to a friendly ground unit and 2 damage to an enemy ground unit.
    case "SEC_030": {
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
      break;
    }
    case "SOR_016": { // Grand Admiral Thrawn — exhaust chosen unit
      if (!targetPlayId) break;
      const target016 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target016) {
        target016.ready = false;
        game.gameLog.push(`${CardTitle("SOR_016")}: exhausted ${CardTitle(target016.cardId)}.`);
      }
      break;
    }
    case "SOR_178": { // Cartel Spacer — exhaust chosen enemy unit
      if (!targetPlayId) break;
      const opp178 = pending.player === 1 ? game.currentGameState.player2 : game.currentGameState.player1;
      const target178 = [...opp178.groundArena, ...opp178.spaceArena].find(u => u.playId === targetPlayId);
      if (target178) {
        target178.ready = false;
        game.gameLog.push(`${CardTitle("SOR_178")}: exhausted ${CardTitle(target178.cardId)}.`);
      }
      break;
    }
    case "SOR_218": { // Asteroid Sanctuary step 1 — exhaust chosen enemy unit
      if (!targetPlayId) break;
      const opp218 = pending.player === 1 ? game.currentGameState.player2 : game.currentGameState.player1;
      const target218 = [...opp218.groundArena, ...opp218.spaceArena].find(u => u.playId === targetPlayId);
      if (target218) {
        target218.ready = false;
        game.gameLog.push(`${CardTitle("SOR_218")}: exhausted ${CardTitle(target218.cardId)}.`);
      }
      break;
    }
    case "SOR_218_shield": { // Asteroid Sanctuary step 2 — give Shield to chosen friendly unit
      if (!targetPlayId) break;
      const me218 = pending.player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const target218s = [...me218.groundArena, ...me218.spaceArena].find(u => u.playId === targetPlayId);
      if (target218s) {
        target218s.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game.currentGameState), owner: target218s.owner, controller: target218s.controller });
        game.gameLog.push(`${CardTitle("SOR_218")}: gave a Shield token to ${CardTitle(target218s.cardId)}.`);
      }
      break;
    }
    case "SOR_231": { // TIE Advanced — give 2 XP to chosen friendly Imperial unit
      if (!targetPlayId) break;
      const me231 = pending.player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const target231 = [...me231.groundArena, ...me231.spaceArena].find(u => u.playId === targetPlayId);
      if (target231) {
        target231.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target231.owner, controller: target231.controller });
        target231.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target231.owner, controller: target231.controller });
        game.gameLog.push(`${CardTitle("SOR_231")}: gave 2 Experience tokens to ${CardTitle(target231.cardId)}.`);
      }
      break;
    }
    case "SOR_133": { // Seventh Sister — deal 3 damage to chosen enemy ground unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_133", targetPlayId, 3, game.gameLog);
      break;
    }
    case "SOR_146": { // Zeb Orrelios — deal 4 damage to chosen ground unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 4, game.gameLog);
      break;
    }
    case "SOR_088": { // Blizzard Assault AT-AT — deal stored excess damage to chosen enemy ground unit
      if (!targetPlayId) break;
      const excessEffect = game.currentGameState.currentEffects.find(e => e.cardId === "SOR_088_excess");
      const damage088 = excessEffect?.value ?? 0;
      game.currentGameState.currentEffects = game.currentGameState.currentEffects.filter(e => e.cardId !== "SOR_088_excess");
      if (damage088 > 0) DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, damage088, game.gameLog);
      break;
    }
    case "SOR_094": { // Bail Organa — give XP to chosen friendly unit
      if (!targetPlayId) break;
      const target094 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target094) {
        target094.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target094.owner, controller: target094.controller });
        game.gameLog.push(`${CardTitle(pending.cardId)}: gave an Experience token to ${CardTitle(target094.cardId)}.`);
      }
      break;
    }
    case "SOR_055": { // The Force Is With Me — give 2 XP; if Force unit in play, give Shield; may attack.
      if (!targetPlayId) break;
      const target055 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target055) break;
      target055.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target055.owner, controller: target055.controller });
      target055.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target055.owner, controller: target055.controller });
      game.gameLog.push(`${CardTitle(pending.cardId)}: gave 2 Experience tokens to ${CardTitle(target055.cardId)}.`);
      if (PlayerHasUnitWithTraitInPlay(pending.player!, "Force")) {
        target055.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game.currentGameState), owner: target055.owner, controller: target055.controller });
        game.gameLog.push(`${CardTitle(pending.cardId)}: gave a Shield token to ${CardTitle(target055.cardId)}.`);
      }
      return {
        type: "ability-option",
        cardId: pending.cardId,
        helperText: `Attack with ${CardTitle(target055.cardId)}?`,
        yesLabel: "Attack",
        noLabel: "Skip",
        onYes: {
          type: "attack-target",
          attackerPlayId: targetPlayId,
          source: pending.cardId,
          continuation: pending.continuation,
        },
        continuation: pending.continuation,
      };
    }
    case "SOR_204": { // Greedo mill: deal 2 damage to the chosen ground unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
      break;
    }
    case "LOF_003": { // Ahsoka Tano — give the chosen friendly unit Sentinel for this phase.
      if (!targetPlayId) break;
      game.currentGameState.currentEffects.push({ cardId: "LOF_003", duration: "Phase", affectedPlayer: pending.player!, targetPlayId });
      const unit003 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      game.gameLog.push(`${CardTitle("LOF_003")}: gave Sentinel to ${CardTitle(unit003?.cardId ?? "")} for this phase.`);
      break;
    }
    case "SEC_182": { // Charged with Treason — deal 5 damage to chosen unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 5, game.gameLog);
      break;
    }
    case "LOF_075": { // Cure Wounds — heal 6 damage from chosen unit
      if (!targetPlayId) break;
      healTarget(game.currentGameState, targetPlayId, 6, game.gameLog, pending.cardId);
      break;
    }
    case "LOF_172": { // Sorcerous Blast — deal 3 damage to chosen unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 3, game.gameLog);
      break;
    }
    case "SOR_176":
    case "SEC_184": { // ISB Agent — deal 1 damage to chosen unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 1, game.gameLog);
      break;
    }
    case "SHD_028": { // Doctor Pershing: deal 1 damage to chosen friendly unit, draw a card.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 1, game.gameLog);
      DrawCardForPlayer(game.currentGameState, game.gameLog, pending.player!);
      break;
    }
    case "SOR_036": { // Gideon Hask: give Experience token to chosen friendly unit
      if (!targetPlayId) break;
      const target036 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target036) {
        target036.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target036.owner, controller: target036.controller });
        game.gameLog.push(`${CardTitle("SOR_036")}: gave an Experience token to ${CardTitle(target036.cardId)}.`);
      }
      break;
    }
    case "LOF_082_defeat": { // Vaneé — defeat one Experience token on the chosen friendly unit, then give one.
      if (!targetPlayId) break;
      const source082 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!source082) break;
      const xpIdx082 = source082.upgrades.findIndex(u => u.cardId === "SOR_T01");
      if (xpIdx082 !== -1) {
        source082.upgrades.splice(xpIdx082, 1);
        game.gameLog.push(`${CardTitle("LOF_082")}: defeated an Experience token on ${CardTitle(source082.cardId)}.`);
      }
      break; // flows to the give step via pending.continuation
    }
    case "LOF_082_give": { // Vaneé — give an Experience token to the chosen friendly unit.
      if (!targetPlayId) break;
      const target082 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target082) {
        target082.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target082.owner, controller: target082.controller });
        game.gameLog.push(`${CardTitle("LOF_082")}: gave an Experience token to ${CardTitle(target082.cardId)}.`);
      }
      break;
    }
    case "SOR_108": { // Vanguard Infantry when-defeated: give Experience token to chosen unit
      if (!targetPlayId) break;
      const target108 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target108) {
        target108.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target108.owner, controller: target108.controller });
        game.gameLog.push(`${CardTitle("SOR_108")}: gave an Experience token to ${CardTitle(target108.cardId)}.`);
      }
      break;
    }
    case "SOR_121": { // Hardpoint Heavy Blaster on-attack: deal 2 damage to chosen unit in defender's arena
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
      return pending.continuation;
    }
    case "SOR_226": { // Admiral Motti when-defeated: ready chosen Villainy unit
      if (!targetPlayId) break;
      const target226 = GetUnitByPlayId(game.currentGameState, targetPlayId);
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
      DealDamageToUnit(game.currentGameState, "SHD_012", targetPlayId, 1, game.gameLog);
      break;
    }
    case "SOR_010": { // Darth Vader: deal 2 damage to chosen unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
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
    case "SEC_006": { // Colonel Yularen front action: chosen unit attacks, then may attack with a unit that costs less than it.
      if (!targetPlayId) break;
      const attacker006 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!attacker006) break;
      const firstCost006 = CardCost(attacker006.cardId);
      const cheaper006 = GetUnitsForPlayer(attacker006.controller, true)
        .filter(u => u.playId !== targetPlayId && CardCost(u.cardId) < firstCost006)
        .map(u => u.playId);
      const second006: PendingResolution | null = cheaper006.length === 0 ? null : {
        type: "ability-option",
        cardId: "SEC_006_second",
        player: attacker006.controller,
        helperText: "Attack with another unit that costs less?",
        yesLabel: "Attack",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "SEC_006_second",
          player: attacker006.controller,
          fromPlayIds: cheaper006,
          continuation: null,
        },
        continuation: null,
      };
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SEC_006",
        continuation: second006,
      };
    }
    case "SEC_006_second": { // Colonel Yularen front action: the chosen cheaper unit attacks.
      if (!targetPlayId) break;
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SEC_006_second",
        continuation: null,
      };
    }
    case "SEC_006_back": { // Colonel Yularen deployed: the chosen unit (cost ≤ 4) attacks.
      if (!targetPlayId) break;
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SEC_006_back",
        continuation: pending.continuation,
      };
    }
    case "SOR_103": { // Rebel Assault: push ForAttack +1 on chosen Rebel unit, then initiate attack with it
      if (!targetPlayId) break;
      const rebelUnit = GetUnitByPlayId(game.currentGameState, targetPlayId);
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
      const unit168 = GetUnitByPlayId(game.currentGameState, targetPlayId);
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
    case "SOR_227": // Snowtrooper Lieutenant — if Imperial, give +2/+0 ForAttack, then attack
    case "SHD_236": {
      if (!targetPlayId) break;
      const unit227 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!unit227) break;
      if (TraitContains(unit227.cardId, "Imperial", unit227.controller, unit227.playId)) {
        game.currentGameState.currentEffects.push({
          cardId: pending.cardId,
          duration: "ForAttack",
          affectedPlayer: unit227.controller,
          targetPlayId,
        });
        game.gameLog.push(`${CardTitle(pending.cardId)}: ${CardTitle(unit227.cardId)} gets +2/+0 for this attack.`);
      }
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: pending.cardId,
        continuation: pending.continuation,
      };
    }
    case "JTL_153": { // Rebellious Hammerhead: deal damage equal to hand size to chosen unit
      if (!targetPlayId) break;
      const sourceUnit = GetUnitByPlayId(game.currentGameState, pending.sourcePlayId!);
      if (!sourceUnit) break;
      const handSize = GetPlayer(game.currentGameState, sourceUnit.controller).hand.length;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, handSize, game.gameLog);
      break;
    }
    case "LAW_247": { // Backed by the Hutts: deal damage equal to friendly Credit count to chosen unit
      if (!targetPlayId) break;
      const credits247 = GetPlayer(game.currentGameState, pending.player!).supplemental.creditTokens ?? 0;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, credits247, game.gameLog);
      break;
    }
    case "JTL_206": { // Fly Casual: ready the chosen Vehicle; it can't attack bases this phase
      if (!targetPlayId) break;
      const unit206 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!unit206) break;
      unit206.ready = true;
      game.currentGameState.currentEffects.push({
        cardId: "JTL_206_no_base",
        duration: "Phase",
        affectedPlayer: pending.player!,
        targetPlayId,
      });
      game.gameLog.push(`${CardTitle("JTL_206")}: readied ${CardTitle(unit206.cardId)} (can't attack bases this phase).`);
      break;
    }
    case "SOR_041": // Power of the Dark Side — defeat the chosen unit (any, including leaders).
    case "SOR_040": { // Avenger WP/OA — defeat the chosen non-leader unit (fromPlayIds already filtered).
      if (!targetPlayId) break;
      const targetToDefeat = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!targetToDefeat) break;
      const defeatPend = defeatUnit(game.currentGameState, game.gameLog, targetToDefeat);
      game.gameLog.push(`${CardTitle(pending.cardId)}: defeated ${CardTitle(targetToDefeat.cardId)}.`);
      if (defeatPend) return injectContinuation(defeatPend, pending.continuation);
      return pending.continuation;
    }
    case "SOR_139": { // Force Choke — deal 5 damage to a non-Vehicle unit; controller draws a card.
      if (!targetPlayId) break;
      const target139 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target139) break;
      DealDamageToUnit(game.currentGameState, "SOR_139", target139.playId, 5, game.gameLog);
      DrawCardForPlayer(game.currentGameState, game.gameLog, target139.controller);
      return pending.continuation;
    }
    case "SOR_077": { // Takedown — defeat a unit with ≤5 remaining HP
      if (!targetPlayId) break;
      const target077 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target077) break;
      if (Unit.FromInterface(target077).CurrentHP() > 5) break;
      const defeatPend077 = defeatUnit(game.currentGameState, game.gameLog, target077);
      game.gameLog.push(`${CardTitle(pending.cardId)} defeated ${CardTitle(target077.cardId)}.`);
      if (defeatPend077) return injectContinuation(defeatPend077, pending.continuation);
      return pending.continuation;
    }
    case "LOF_079": { // Shatterpoint — both modes end the same way: defeat the chosen unit.
      if (!targetPlayId) break;
      const target079 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target079) break;
      if (CardIsLeader(target079.cardId)) break;
      const defeatPend079 = defeatUnit(game.currentGameState, game.gameLog, target079);
      game.gameLog.push(`${CardTitle(pending.cardId)} defeated ${CardTitle(target079.cardId)}.`);
      if (defeatPend079) return injectContinuation(defeatPend079, pending.continuation);
      return pending.continuation;
    }
    case "JTL_043": { // No Glory, Only Results — take control of a non-leader unit, then defeat it.
      if (!targetPlayId) break;
      const target043 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target043) break;
      if (CardIsLeader(target043.cardId)) break;
      // Order matters: the unit is defeated while under the caster's control, so its
      // When Defeated ability resolves for the caster, not its owner.
      transferControl(game.currentGameState, game.gameLog, Unit.FromInterface(target043), pending.player!);
      const defeatPend043 = defeatUnit(game.currentGameState, game.gameLog, target043);
      game.gameLog.push(`${CardTitle(pending.cardId)} defeated ${CardTitle(target043.cardId)}.`);
      if (defeatPend043) return injectContinuation(defeatPend043, pending.continuation);
      return pending.continuation;
    }
    case "LAW_133": { // Lost and Forgotten — defeat a non-leader unit, then heal 3 from your base.
      if (!targetPlayId) break;
      const target133 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target133) break;
      if (CardIsLeader(target133.cardId)) break;
      const defeatPend133 = defeatUnit(game.currentGameState, game.gameLog, target133);
      game.gameLog.push(`${CardTitle(pending.cardId)} defeated ${CardTitle(target133.cardId)}.`);
      // "If you do" — the unit was defeated, so the heal follows.
      HealBaseForPlayer(game.currentGameState, pending.player!, 3, game.gameLog, pending.cardId);
      if (defeatPend133) return injectContinuation(defeatPend133, pending.continuation);
      return pending.continuation;
    }
    case "SEC_258": // Grassroots Resistance — deal 3 to a unit, then heal 3 from your base.
    case "ASH_258": { // reprint of SEC_258
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 3, game.gameLog);
      // The heal is unconditional — it is a second sentence, not an "if you do".
      HealBaseForPlayer(game.currentGameState, pending.player!, 3, game.gameLog, pending.cardId);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "SOR_078": // Vanquish — defeat a non-leader unit.
    case "TWI_077": { // reprint of SOR_078
      if (!targetPlayId) break;
      const target078 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target078) break;
      if (CardIsLeader(target078.cardId)) break;
      const defeatPend078 = defeatUnit(game.currentGameState, game.gameLog, target078);
      game.gameLog.push(`${CardTitle(pending.cardId)} defeated ${CardTitle(target078.cardId)}.`);
      if (defeatPend078) return injectContinuation(defeatPend078, pending.continuation);
      return pending.continuation;
    }
    case "SEC_034": { // Cad Bane — defeat a unit with ≤2 remaining HP
      if (!targetPlayId) break;
      const target034 = GetUnitByPlayId(game.currentGameState, targetPlayId);
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
      const unit224 = GetUnitByPlayId(game.currentGameState, targetPlayId);
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
      const target073 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target073) break;
      target073.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game.currentGameState), owner: target073.owner, controller: target073.controller });
      game.gameLog.push(`${CardTitle(pending.cardId)}: Shield token placed on ${CardTitle(target073.cardId)}.`);
      break;
    }
    case "SOR_241": { // Wing Leader — "Give 2 Experience tokens to another friendly REBEL unit."
      if (!targetPlayId) break;
      const target241 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target241) break;
      target241.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target241.owner, controller: target241.controller });
      target241.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target241.owner, controller: target241.controller });
      game.gameLog.push(`${CardTitle(pending.cardId)}: 2 Experience tokens given to ${CardTitle(target241.cardId)}.`);
      break;
    }
    case "SOR_187_opp": { // I Had No Choice — opponent chooses which of the 2 units returns to hand; the other goes to deck bottom.
      if (!targetPlayId) break;
      const handUnit = removeFromArena(game.currentGameState, targetPlayId);
      if (handUnit && !handUnit.unit.IsTokenUnit()) {
        GetPlayer(game.currentGameState, handUnit.unit.owner).hand.push({ cardId: handUnit.unit.cardId });
        game.gameLog.push(`${CardTitle("SOR_187")}: ${CardTitle(handUnit.unit.cardId)} returned to Player ${handUnit.unit.owner}'s hand.`);
      }
      const otherId187 = pending.fromPlayIds.find(id => id !== targetPlayId);
      if (otherId187) {
        const deckUnit = removeFromArena(game.currentGameState, otherId187);
        if (deckUnit) {
          GetPlayer(game.currentGameState, deckUnit.unit.owner).deck.unshift({ cardId: deckUnit.unit.cardId });
          game.gameLog.push(`${CardTitle("SOR_187")}: ${CardTitle(deckUnit.unit.cardId)} put on the bottom of Player ${deckUnit.unit.owner}'s deck.`);
        }
      }
      break;
    }
    case "SOR_223": { // Don't Get Cocky — choose a unit, then reveal cards from deck up to 7
      if (!targetPlayId || !pending.player) break;
      const gs223 = game.currentGameState;
      const deck223 = GetPlayer(gs223, pending.player).deck;
      const revealedCards223: Array<{ tempId: string; cardId: string; cost: number }> = [];
      if (deck223.length > 0) {
        const card223 = deck223.pop()!;
        revealedCards223.push({ tempId: "0", cardId: card223.cardId, cost: CardCost(card223.cardId) ?? 0 });
      }
      const dgcPending: DontGetCockyPending = {
        type: "dont-get-cocky",
        cardId: "SOR_223",
        player: pending.player,
        targetPlayId,
        revealedCards: revealedCards223,
      };
      return dgcPending;
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
      GetPlayer(game.currentGameState, bouncedUnit.owner).hand.push({ cardId: bouncedUnit.cardId });
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
      const enemyPlayer132 = GetOtherPlayer(pending.player);
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
      const friendlyUnit = GetUnitByPlayId(gs132, pending.sourcePlayId);
      const enemyUnit = GetUnitByPlayId(gs132, targetPlayId);
      if (!friendlyUnit || !enemyUnit) break;
      const friendlyOriginalController = friendlyUnit.controller;
      const enemyOriginalController = enemyUnit.controller;
      transferControl(gs132, game.gameLog, friendlyUnit, enemyOriginalController);
      transferControl(gs132, game.gameLog, enemyUnit, friendlyOriginalController);
      break;
    }
    case "SOR_234": { // Maximum Firepower step 1: chose first Imperial, prompt for damage target.
      if (!targetPlayId || !pending.player) break;
      const allUnits234 = GetAllUnits(game.currentGameState);
      return {
        type: "ability-target",
        cardId: "SOR_234_deal",
        player: pending.player,
        sourcePlayId: targetPlayId,
        fromPlayIds: allUnits234.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_234_deal": { // Maximum Firepower step 2: chose target, deal first Imperial's power, prompt for second.
      if (!targetPlayId || !pending.sourcePlayId || !pending.player) break;
      const imperial1_234 = GetUnitByPlayId(game.currentGameState, pending.sourcePlayId);
      if (imperial1_234) {
        const power1 = Unit.FromInterface(imperial1_234).CurrentPower();
        DealDamageToUnit(game.currentGameState, "SOR_234", targetPlayId, power1, game.gameLog);
        game.gameLog.push(`${CardTitle("SOR_234")}: ${CardTitle(imperial1_234.cardId)} dealt ${power1} damage.`);
      }
      const remaining234 = GetAllUnits(game.currentGameState).filter(u =>
        u.controller === pending.player &&
        TraitContains(u.cardId, "Imperial", pending.player!, u.playId) &&
        u.playId !== pending.sourcePlayId
      );
      if (remaining234.length === 0) break;
      return {
        type: "ability-target",
        cardId: "SOR_234_2",
        player: pending.player,
        sourcePlayId: targetPlayId,
        fromPlayIds: remaining234.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_234_2": { // Maximum Firepower step 3: chose second Imperial, deal its power to stored target.
      if (!targetPlayId || !pending.sourcePlayId) break;
      const imperial2_234 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (imperial2_234) {
        const power2 = Unit.FromInterface(imperial2_234).CurrentPower();
        DealDamageToUnit(game.currentGameState, "SOR_234", pending.sourcePlayId, power2, game.gameLog);
        game.gameLog.push(`${CardTitle("SOR_234")}: ${CardTitle(imperial2_234.cardId)} dealt ${power2} damage.`);
      }
      break;
    }
    case "SOR_127": { // Strike True — step 1: chose friendly unit, now prompt for enemy target
      if (!targetPlayId || !pending.player) break;
      const enemy127 = chooseEnemyForPowerDamage("SOR_127_deal", pending.player, targetPlayId, game.currentGameState);
      if (enemy127) return enemy127;
      break;
    }
    case "SOR_127_deal": { // Strike True — step 2: deal power damage to chosen enemy unit
      if (!targetPlayId || !pending.sourcePlayId) break;
      dealPowerToEnemy(game.currentGameState, game.gameLog, "Strike True", pending.sourcePlayId, targetPlayId);
      break;
    }
    case "LAW_168": { // Haymaker — step 1: chose friendly unit; give it an Experience token, then prompt for a same-arena enemy.
      if (!targetPlayId || !pending.player) break;
      const marine168 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (marine168) {
        marine168.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: marine168.owner, controller: marine168.controller });
        game.gameLog.push(`${CardTitle("LAW_168")}: gave an Experience token to ${CardTitle(marine168.cardId)}.`);
      }
      const enemy168 = chooseEnemyForPowerDamage("LAW_168_deal", pending.player, targetPlayId, game.currentGameState, { sameArena: true });
      if (enemy168) return enemy168;
      break;
    }
    case "LAW_168_deal": { // Haymaker — step 2: the boosted unit deals its power to the chosen enemy unit.
      if (!targetPlayId || !pending.sourcePlayId) break;
      dealPowerToEnemy(game.currentGameState, game.gameLog, "Haymaker", pending.sourcePlayId, targetPlayId);
      break;
    }
    case "SOR_162": //Disabling Fang Fighter
    case "SHD_166": //reprint of SOR_162
    case "SOR_251": { // Confiscate — defeat an upgrade
      if (!targetPlayId) break;
      const lukePending = defeatUpgradeByPlayId(game.currentGameState, game.gameLog, targetPlayId, "Confiscate", pending.continuation ?? null);
      if (lukePending) return lukePending;
      break;
    }
    case "SHD_147_defeat_upgrade": { // Ketsu Onyo — after combat damage to a base, defeat an upgrade costing 2 or less
      if (!targetPlayId) break;
      const lukePending147 = defeatUpgradeByPlayId(game.currentGameState, game.gameLog, targetPlayId, CardTitle("SHD_147"), pending.continuation ?? null);
      if (lukePending147) return lukePending147;
      break;
    }
    case "SHD_008": { // Boba Fett leader reaction: exhaust leader, give chosen unit +1/+0 for this phase
      if (!targetPlayId) break;
      const gs008 = game.currentGameState;
      GetPlayer(gs008, pending.player!).leader.ready = false;
      gs008.currentEffects.push({
        cardId: "SHD_008",
        duration: "Phase",
        affectedPlayer: pending.player!,
        targetPlayId,
      });
      const target008 = GetUnitByPlayId(gs008, targetPlayId);
      game.gameLog.push(
        `Boba Fett: gave +1/+0 to ${CardTitle(target008?.cardId ?? "") ?? targetPlayId} for this phase.`
      );
      break;
    }
    case "SOR_106_3": { // Attack Pattern Delta — step 1: give chosen unit +3/+3 for this phase
      if (!targetPlayId) break;
      const gs3 = game.currentGameState;
      gs3.currentEffects.push({ cardId: "SOR_106_3", duration: "Phase", affectedPlayer: pending.player!, targetPlayId });
      const t3 = GetUnitByPlayId(gs3, targetPlayId);
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
      const t2 = GetUnitByPlayId(gs2, targetPlayId);
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
      const t1 = GetUnitByPlayId(gs1, targetPlayId);
      game.gameLog.push(`Attack Pattern Delta: ${CardTitle(t1?.cardId ?? "") ?? targetPlayId} gets +1/+1 for this phase.`);
      break;
    }
    case "SOR_060": { // Distant Patroller WD: Give a Shield token to the chosen Vigilance unit.
      if (!targetPlayId) break;
      const target060 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target060) {
        target060.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game.currentGameState), owner: target060.owner, controller: target060.controller });
        game.gameLog.push(`${CardTitle("SOR_060")}: Shield token given to ${CardTitle(target060.cardId)}.`);
      }
      break;
    }
    case "SOR_142": { // Explosives Artist OA: deal 1 damage to chosen unit or base, then proceed.
      if (targetIsBase) {
        const opp142: PlayerId = pending.player === 1 ? 2 : 1;
        GetPlayer(game.currentGameState, opp142).base.damage += 1;
        game.gameLog.push(`${CardTitle("SOR_142")}: dealt 1 damage to player ${opp142}'s base.`);
      } else if (targetPlayId) {
        const baseMatch142 = targetPlayId.match(/^player([12])\.base$/);
        if (baseMatch142) {
          const basePlayer142 = Number(baseMatch142[1]) as PlayerId;
          GetPlayer(game.currentGameState, basePlayer142).base.damage += 1;
          game.gameLog.push(`${CardTitle("SOR_142")}: dealt 1 damage to player ${basePlayer142}'s base.`);
        } else {
          DealDamageToUnit(game.currentGameState, "SOR_142", targetPlayId, 1, game.gameLog);
        }
      }
      return pending.continuation;
    }
    case "SOR_059": { // 2-1B Surgical Droid OA: Heal 2 from chosen unit, then proceed to combat.
      if (!targetPlayId) return pending.continuation;
      healTarget(game.currentGameState, targetPlayId, 2, game.gameLog, "SOR_059");
      return pending.continuation;
    }
    case "SOR_132": { // Imperial Interceptor WP: Deal 3 damage to chosen space unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 3, game.gameLog);
      break;
    }
    case "SOR_134": { // Ruthless Raider WP/WD: Deal 2 to enemy base + 2 to chosen enemy unit.
      if (!targetPlayId) break;
      // Base damage is applied here (once, at resolution) rather than in resolveWhenPlayed,
      // which is called twice for units; the no-enemy-unit paths handle the base separately.
      if (pending.player) {
        const oppBase134 = pending.player === 1 ? game.currentGameState.player2 : game.currentGameState.player1;
        oppBase134.base.damage += 2;
        game.gameLog.push(`${CardTitle("SOR_134")}: dealt 2 damage to opponent's base.`);
      }
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
      break;
    }
    case "SOR_051": { // Luke Skywalker — Give –3/–3 (or –6/–6 if friendly died this phase) to chosen enemy.
      if (!targetPlayId || !pending.player) break;
      const target051 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target051) break;
      const friendlyDefeated051 = game.currentGameState.roundState.cardsLeftPlayThisPhase
        .some(c => c.fromPlayer === pending.player && (c.reason === "defeated" || c.reason === "token-defeated"));
      const debuff051 = friendlyDefeated051 ? 6 : 3;
      game.currentGameState.currentEffects.push({
        cardId: "SOR_051",
        duration: "Phase",
        affectedPlayer: target051.controller as import("@/lib/engine/core-models").PlayerId,
        targetPlayId,
        value: debuff051,
      });
      game.gameLog.push(`${CardTitle("SOR_051")}: gave –${debuff051}/–${debuff051} to ${CardTitle(target051.cardId)} for this phase.`);
      break;
    }
    case "SOR_076": { // Make an Opening: –2/–2 Phase to chosen unit + heal 2 from own base.
      if (!targetPlayId) break;
      const target076 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target076) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_076", duration: "Phase", affectedPlayer: target076.controller, targetPlayId });
        game.gameLog.push(`${CardTitle("SOR_076")}: gave –2/–2 to ${CardTitle(target076.cardId)} for this phase.`);
      }
      const ownBaseId076 = `player${pending.player}.base`;
      healTarget(game.currentGameState, ownBaseId076, 2, game.gameLog, "SOR_076");
      break;
    }
    case "SOR_124": { // Tactical Advantage: +2/+2 Phase to chosen unit.
      if (!targetPlayId) break;
      const target124 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target124) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_124", duration: "Phase", affectedPlayer: target124.controller, targetPlayId });
        game.gameLog.push(`${CardTitle("SOR_124")}: gave +2/+2 to ${CardTitle(target124.cardId)} for this phase.`);
      }
      break;
    }
    case "SOR_151": { // Karabast step 1: track chosen friendly unit, proceed to pick enemy.
      if (!targetPlayId) break;
      game.currentGameState.currentEffects.push({ cardId: "SOR_151_src", duration: "Phase", affectedPlayer: pending.player!, targetPlayId });
      return pending.continuation;
    }
    case "SOR_151_deal": { // Karabast step 2: deal power+damage of stored friendly to chosen enemy.
      if (!targetPlayId) break;
      const gs151 = game.currentGameState;
      const srcEffect151 = gs151.currentEffects.find(e => e.cardId === "SOR_151_src");
      const srcPlayId151 = srcEffect151?.targetPlayId;
      gs151.currentEffects = gs151.currentEffects.filter(e => e.cardId !== "SOR_151_src");
      const src151 = srcPlayId151 ? GetUnitByPlayId(gs151, srcPlayId151) : null;
      const dmg151 = src151 ? (src151.damage + Unit.FromInterface(src151).CurrentPower()) : 0;
      if (dmg151 > 0) {
        DealDamageToUnit(gs151, "SOR_151", targetPlayId, dmg151, game.gameLog);
      }
      break;
    }
    case "SOR_169": { // Keep Fighting: Ready the chosen unit.
      if (!targetPlayId) break;
      const target169 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target169) {
        const prevented169 = game.currentGameState.currentEffects.some(
          e => e.cardId === "SOR_186_no_ready" && e.targetPlayId === target169.playId,
        );
        if (!prevented169) {
          target169.ready = true;
          game.gameLog.push(`${CardTitle("SOR_169")}: readied ${CardTitle(target169.cardId)}.`);
        } else {
          game.gameLog.push(`${CardTitle("SOR_169")}: ${CardTitle(target169.cardId)} can't ready this round.`);
        }
      }
      break;
    }
    case "SOR_170": { // Power Failure: Defeat all upgrades on the chosen unit.
      if (!targetPlayId) break;
      const target170 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target170) {
        const count170 = target170.upgrades.length;
        target170.upgrades = [];
        game.gameLog.push(`${CardTitle("SOR_170")}: defeated ${count170} upgrade(s) on ${CardTitle(target170.cardId)}.`);
      }
      break;
    }
    case "SOR_172": { // Open Fire: Deal 4 damage to the chosen unit.
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 4, game.gameLog);
      break;
    }
    case "SOR_186": { // No Good to Me Dead — Exhaust the chosen unit; prevent it from readying this round.
      if (!targetPlayId) break;
      const target186 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target186) {
        target186.ready = false;
        game.currentGameState.currentEffects.push({
          cardId: "SOR_186_no_ready",
          duration: "Round",
          affectedPlayer: target186.controller,
          targetPlayId: target186.playId,
        });
        game.gameLog.push(`${CardTitle("SOR_186")}: exhausted ${CardTitle(target186.cardId)} — it can't ready this round.`);
      }
      break;
    }
    case "SOR_233": { // I Am Your Father — opponent chose unit; present them with take-7 or say-no option.
      if (!targetPlayId || !pending.player) break;
      const target233 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target233) break;
      return {
        type: "ability-option",
        cardId: "SOR_233",
        player: target233.controller as import("@/lib/engine/core-models").PlayerId,
        sourcePlayId: targetPlayId,
        helperText: `Take 7 damage to ${CardTitle(target233.cardId)}? (No = opponent draws 3 cards)`,
        yesLabel: "Take 7 damage",
        noLabel: "Say No",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_199": { // Bamboozle — Exhaust the chosen unit; return each non-token upgrade to its owner's hand.
      if (!targetPlayId) break;
      const target199 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target199) {
        target199.ready = false;
        game.gameLog.push(`${CardTitle("SOR_199")}: exhausted ${CardTitle(target199.cardId)}.`);
        const upgrades199 = [...target199.upgrades];
        target199.upgrades = [];
        for (const upg of upgrades199) {
          if (/_T\d+$/.test(upg.cardId)) {
            game.gameLog.push(`${CardTitle("SOR_199")}: ${CardTitle(upg.cardId)} token set aside.`);
          } else {
            GetPlayer(game.currentGameState, upg.owner as PlayerId).hand.push({ cardId: upg.cardId });
            game.gameLog.push(`${CardTitle("SOR_199")}: returned ${CardTitle(upg.cardId)} to Player ${upg.owner}'s hand.`);
          }
        }
      }
      break;
    }
    case "SOR_167_damage": { // Force Throw bonus: deal stored damage (= discarded card's cost) to the chosen unit.
      const effect167 = game.currentGameState.currentEffects.find(e => e.cardId === "SOR_167_damage");
      const dmg167 = effect167?.value ?? 0;
      game.currentGameState.currentEffects = game.currentGameState.currentEffects.filter(e => e.cardId !== "SOR_167_damage");
      if (dmg167 > 0) {
        DealDamageToUnit(game.currentGameState, "SOR_167", targetPlayId, dmg167, game.gameLog);
      }
      break;
    }
    case "SOR_189_ready": { // Leia Organa yes path: ready the chosen resource.
      if (!targetPlayId) break;
      const pState189 = pending.player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const resource189 = pState189.resources.find(r => r.playId === targetPlayId);
      if (resource189) {
        resource189.ready = true;
        game.gameLog.push(`${CardTitle("SOR_189")}: readied a resource.`);
      }
      break;
    }
    case "SOR_189_exhaust": { // Leia Organa no path: exhaust the chosen unit.
      if (!targetPlayId) break;
      const target189 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target189) {
        target189.ready = false;
        game.gameLog.push(`${CardTitle("SOR_189")}: exhausted ${CardTitle(target189.cardId)}.`);
      }
      break;
    }
    case "SOR_202": { // Cantina Bouncer: Return chosen non-leader unit to owner's hand.
      if (!targetPlayId) break;
      const gs202 = game.currentGameState;
      const bounced202 = removeFromArena(gs202, targetPlayId);
      if (bounced202) {
        if (!bounced202.unit.IsTokenUnit()) {
          GetPlayer(gs202, bounced202.unit.owner).hand.push({ cardId: bounced202.unit.cardId });
          game.gameLog.push(`${CardTitle("SOR_202")}: returned ${CardTitle(bounced202.unit.cardId)} to hand.`);
        }
      }
      break;
    }
    case "SOR_038": // Count Dooku (Darth Tyranus) When Played: defeat chosen unit with ≤4 HP.
    case "C24_001": {
      if (!targetPlayId) break;
      const defeated038 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!defeated038) break;
      const defeatPend038 = defeatUnit(game.currentGameState, game.gameLog, defeated038);
      game.gameLog.push(`${CardTitle(pending.cardId)}: defeated ${CardTitle(defeated038.cardId)}.`);
      if (defeatPend038) return injectContinuation(defeatPend038, pending.continuation);
      return pending.continuation;
    }
    case "SOR_050": { // The Ghost When Played/On Attack: give Shield to chosen Spectre unit.
      if (!targetPlayId) break;
      const target050 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target050) {
        target050.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game.currentGameState), owner: target050.owner, controller: target050.controller });
        game.gameLog.push(`${CardTitle("SOR_050")}: gave a Shield token to ${CardTitle(target050.cardId)}.`);
      }
      break;
    }
    case "SOR_090": { // Devastator When Played: deal resources-count damage to chosen unit.
      if (!targetPlayId) break;
      const gs090d = game.currentGameState;
      const resourceCount090 = (pending.player === 1 ? gs090d.player1 : gs090d.player2).resources.length;
      DealDamageToUnit(gs090d, "SOR_090", targetPlayId, resourceCount090, game.gameLog);
      break;
    }
    case "LAW_045": { // Zeb Orellios When Played: deal 3 (or 5 if you control a Command or Cunning unit) to the chosen ground unit.
      if (!targetPlayId || pending.player === undefined) break;
      const amount045 = (PlayerHasUnitWithAspectInPlay(pending.player, "Command") || PlayerHasUnitWithAspectInPlay(pending.player, "Cunning")) ? 5 : 3;
      DealDamageToUnit(game.currentGameState, "LAW_045", targetPlayId, amount045, game.gameLog);
      break;
    }
    case "SOR_131": { // Fifth Brother On Attack: deal 1 to himself + 1 to a chosen other ground unit.
      if (!targetPlayId || !pending.sourcePlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_131", pending.sourcePlayId, 1, game.gameLog); // this unit
      DealDamageToUnit(game.currentGameState, "SOR_131", targetPlayId, 1, game.gameLog);         // another ground unit
      break;
    }
    case "SOR_131_self": { // Fifth Brother On Attack: no other ground unit — deal 1 to himself only.
      if (!pending.sourcePlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_131", pending.sourcePlayId, 1, game.gameLog);
      break;
    }
    case "take-control-upgrade": { // Take-control step 1: chose the upgrade — now pick a different eligible unit (Hondo JTL_056, Shuttle ST-149 JTL_242).
      if (!targetPlayId || pending.player === undefined) break; // no upgrade chosen — continue
      const gsTc = game.currentGameState;
      let upgradeCardIdTc: string | undefined;
      let currentUnitPlayIdTc: string | undefined;
      for (const u of GetAllUnits(gsTc)) {
        const found = u.upgrades.find(upg => upg.playId === targetPlayId);
        if (found) { upgradeCardIdTc = found.cardId; currentUnitPlayIdTc = u.playId; break; }
      }
      if (!upgradeCardIdTc) break;
      const destsTc = UpgradeEligibleTargets(upgradeCardIdTc, gsTc, pending.player)
        .filter(id => id !== currentUnitPlayIdTc);
      if (destsTc.length === 0) {
        game.gameLog.push(`No eligible unit to move ${CardTitle(upgradeCardIdTc)} to.`);
        break; // continue
      }
      return {
        type: "ability-target",
        cardId: "take-control-unit",
        player: pending.player,
        sourcePlayId: targetPlayId, // carry the chosen upgrade's playId into step 2
        fromPlayIds: destsTc,
        continuation: pending.continuation,
      } satisfies AbilityTargetPending;
    }
    case "take-control-unit": { // Take-control step 2: attach the chosen upgrade to the chosen unit.
      if (!targetPlayId || !pending.sourcePlayId || pending.player === undefined) break;
      moveUpgradeToUnit(game.currentGameState, game.gameLog, pending.sourcePlayId, targetPlayId, pending.player);
      break;
    }
    case "SOR_097": { // Admiral Ackbar When Played: deal damage = friendly units in the target's arena.
      if (!targetPlayId) break;
      const gs097 = game.currentGameState;
      const isGround097 = [...gs097.player1.groundArena, ...gs097.player2.groundArena].some(u => u.playId === targetPlayId);
      const arena097 = isGround097
        ? [...gs097.player1.groundArena, ...gs097.player2.groundArena]
        : [...gs097.player1.spaceArena, ...gs097.player2.spaceArena];
      const friendlyCount097 = arena097.filter(u => u.controller === pending.player).length;
      DealDamageToUnit(gs097, "SOR_097", targetPlayId, friendlyCount097, game.gameLog);
      break;
    }
    case "SOR_116": { // Steadfast Battalion On Attack: give chosen friendly unit +2/+2 for this phase.
      if (!targetPlayId) break;
      const target116 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target116) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_116", duration: "Phase", affectedPlayer: target116.controller, targetPlayId });
        game.gameLog.push(`${CardTitle("SOR_116")}: gave +2/+2 to ${CardTitle(target116.cardId)} for this phase.`);
      }
      break;
    }
    case "SOR_086": { // Gladiator Star Destroyer When Played: give chosen unit Sentinel for this phase.
      if (!targetPlayId) break;
      const target086 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target086) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_086", duration: "Phase", affectedPlayer: target086.controller, targetPlayId });
        game.gameLog.push(`${CardTitle("SOR_086")}: ${CardTitle(target086.cardId)} gains Sentinel for this phase.`);
      }
      break;
    }
    case "SOR_140": { // SpecForce Soldier When Played: chosen unit loses Sentinel for this phase.
      if (!targetPlayId) break;
      const target140 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target140) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_140", duration: "Phase", affectedPlayer: target140.controller, targetPlayId });
        game.gameLog.push(`${CardTitle("SOR_140")}: ${CardTitle(target140.cardId)} loses Sentinel for this phase.`);
      }
      break;
    }
    case "SOR_143": { // Fighters for Freedom: deal 1 damage to chosen base
      if (!targetPlayId) break;
      if (targetPlayId === "player1.base") {
        dealBaseDamage(game.currentGameState, 1, 1);
        game.gameLog.push(`${CardTitle("SOR_143")}: dealt 1 damage to Player 1's base.`);
      } else if (targetPlayId === "player2.base") {
        dealBaseDamage(game.currentGameState, 2, 1);
        game.gameLog.push(`${CardTitle("SOR_143")}: dealt 1 damage to Player 2's base.`);
      }
      break;
    }
    case "TWI_018": { // Quinlan Vos — deal 1 damage to the chosen enemy unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "TWI_018", targetPlayId, 1, game.gameLog);
      break;
    }
    case "SHD_014": { // Cad Bane — deal `amount` (1 front / 2 deployed) to the opponent-chosen unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SHD_014", targetPlayId, pending.amount ?? 1, game.gameLog);
      break;
    }
    case "SHD_018": { // The Mandalorian — exhaust the chosen enemy unit.
      if (!targetPlayId) break;
      const opp018 = pending.player === 1 ? game.currentGameState.player2 : game.currentGameState.player1;
      const target018 = [...opp018.groundArena, ...opp018.spaceArena].find(u => u.playId === targetPlayId);
      if (target018) {
        target018.ready = false;
        game.gameLog.push(`${CardTitle("SHD_018")}: exhausted ${CardTitle(target018.cardId)}.`);
      }
      break;
    }
    case "SHD_172": { // Krayt Dragon: deal `amount` (played card's cost) to chosen base or ground unit.
      if (!targetPlayId) break;
      const amt172 = pending.amount ?? 0;
      const baseMatch172 = targetPlayId.match(/^player([12])\.base$/);
      if (baseMatch172) {
        dealBaseDamage(game.currentGameState, Number(baseMatch172[1]) as PlayerId, amt172);
        game.gameLog.push(`${CardTitle("SHD_172")}: dealt ${amt172} damage to Player ${baseMatch172[1]}'s base.`);
      } else {
        DealDamageToUnit(game.currentGameState, "SHD_172", targetPlayId, amt172, game.gameLog);
      }
      break;
    }
    case "SOR_158": { // Jedha Agitator On Attack: deal 2 damage to chosen ground unit or base.
      if (!targetPlayId) break;
      if (targetPlayId === "player1.base") {
        game.currentGameState.player1.base.damage += 2;
        game.gameLog.push(`${CardTitle("SOR_158")}: dealt 2 damage to Player 1's base.`);
      } else if (targetPlayId === "player2.base") {
        game.currentGameState.player2.base.damage += 2;
        game.gameLog.push(`${CardTitle("SOR_158")}: dealt 2 damage to Player 2's base.`);
      } else {
        DealDamageToUnit(game.currentGameState, "SOR_158", targetPlayId, 2, game.gameLog);
      }
      break;
    }
    case "SOR_208": { // Outer Rim Headhunter On Attack: exhaust chosen non-leader unit.
      if (!targetPlayId) break;
      const target208 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target208) {
        target208.ready = false;
        game.gameLog.push(`${CardTitle("SOR_208")}: exhausted ${CardTitle(target208.cardId)}.`);
      }
      break;
    }
    case "SOR_209": { // Pirated Starfighter When Played: return chosen friendly non-leader unit to hand.
      if (!targetPlayId) break;
      const gs209 = game.currentGameState;
      const bounced209 = removeFromArena(gs209, targetPlayId);
      if (bounced209 && !bounced209.unit.IsTokenUnit()) {
        GetPlayer(gs209, bounced209.unit.owner).hand.push({ cardId: bounced209.unit.cardId });
        game.gameLog.push(`${CardTitle("SOR_209")}: returned ${CardTitle(bounced209.unit.cardId)} to hand.`);
      }
      break;
    }
    case "SOR_244": { // Snowspeeder On Attack: exhaust chosen enemy Vehicle ground unit.
      if (!targetPlayId) break;
      const target244 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target244) {
        target244.ready = false;
        game.gameLog.push(`${CardTitle("SOR_244")}: exhausted ${CardTitle(target244.cardId)}.`);
      }
      break;
    }
    case "SOR_099": { // Home One When Played: return chosen friendly non-leader ground unit to hand and draw a card.
      if (!targetPlayId) break;
      const gs099 = game.currentGameState;
      const bounced099 = removeFromArena(gs099, targetPlayId);
      if (bounced099 && !bounced099.unit.IsTokenUnit()) {
        GetPlayer(gs099, bounced099.unit.owner).hand.push({ cardId: bounced099.unit.cardId });
        DrawCardForPlayer(gs099, game.gameLog, pending.player!);
        game.gameLog.push(`${CardTitle("SOR_099")}: returned ${CardTitle(bounced099.unit.cardId)} to hand and drew a card.`);
      }
      break;
    }
    case "SOR_136": { // Vader's Lightsaber When Played: deal 4 damage to a ground unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_136", targetPlayId, 4, game.gameLog);
      break;
    }
    case "SOR_049": { // Obi-Wan Kenobi When Defeated: give 2 XP to chosen friendly unit; if Force, draw a card.
      if (!targetPlayId) break;
      const target049 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target049) break;
      target049.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target049.owner, controller: target049.controller });
      target049.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target049.owner, controller: target049.controller });
      game.gameLog.push(`${CardTitle("SOR_049")}: gave 2 Experience tokens to ${CardTitle(target049.cardId)}.`);
      if (CardTraits(target049.cardId).includes("Force")) {
        DrawCardForPlayer(game.currentGameState, game.gameLog, pending.player!);
        game.gameLog.push(`${CardTitle("SOR_049")}: drew a card (Force unit).`);
      }
      break;
    }
    case "SOR_216": { // Disarm: –4/+0 Phase to chosen enemy unit.
      if (!targetPlayId) break;
      const target216 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target216) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_216", duration: "Phase", affectedPlayer: target216.controller, targetPlayId });
        game.gameLog.push(`${CardTitle("SOR_216")}: gave –4/+0 to ${CardTitle(target216.cardId)} for this phase.`);
      }
      break;
    }
    case "SOR_217": { // Shoot First: +1/+0 ForAttack + first-strike effect, then attack
      if (!targetPlayId) break;
      const unit217 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!unit217) break;
      game.currentGameState.currentEffects.push({
        cardId: "SOR_217",
        duration: "ForAttack",
        affectedPlayer: unit217.controller,
        targetPlayId,
      });
      game.currentGameState.currentEffects.push({
        cardId: "SOR_217_first_strike",
        duration: "ForAttack",
        affectedPlayer: unit217.controller,
        targetPlayId,
      });
      game.gameLog.push(`${CardTitle(pending.cardId)}: ${CardTitle(unit217.cardId)} gets +1/+0 and first-strike for this attack.`);
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SOR_217",
        continuation: pending.continuation,
      };
    }
    case "SOR_220": { // Surprise Strike: +3/+0 ForAttack then attack with chosen unit.
      if (!targetPlayId) break;
      game.currentGameState.currentEffects.push({ cardId: "SOR_220", duration: "ForAttack", affectedPlayer: pending.player!, targetPlayId });
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SOR_220",
        continuation: null,
      };
    }
    case "SOR_110": { // Frontline Shuttle: attack with the chosen space unit (no base allowed).
      if (!targetPlayId) break;
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SOR_110",
        continuation: null,
      };
    }
    case "TWI_012": { // Anakin Skywalker leader Action: attack with the chosen unit (+2/+0 vs a unit).
      if (!targetPlayId) break;
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "TWI_012",
        continuation: null,
      };
    }
    case "SOR_129_ready": { // Admiral Ozzel: opponent chose a unit to ready.
      if (!targetPlayId) break;
      const readyTarget = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (readyTarget) {
        readyTarget.ready = true;
        game.gameLog.push(`${CardTitle("SOR_129")}: opponent readied ${CardTitle(readyTarget.cardId)}.`);
      }
      break;
    }
    case "SOR_240": { // Fleet Lieutenant: if Rebel +2/+0 ForAttack, then attack with chosen unit.
      if (!targetPlayId) break;
      const chosen240 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (chosen240 && TraitContains(chosen240.cardId, "Rebel", chosen240.controller, chosen240.playId)) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_240", duration: "ForAttack", affectedPlayer: pending.player!, targetPlayId });
      }
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SOR_240",
        continuation: null,
      };
    }
    case "SOR_092": { // Overwhelming Barrage — +2/+2 and spread power damage
      if (!targetPlayId) break;
      const target092 = GetUnitByPlayId(game.currentGameState, targetPlayId);
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
    case "LAW_008_action": { // Director Krennic Action — defeat the chosen friendly unit (cost), then create a Credit token.
      if (!targetPlayId) break;
      const sacrifice008 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!sacrifice008) break;
      defeatUnit(game.currentGameState, game.gameLog, sacrifice008);
      updateDefeatedPlayers(game.currentGameState);
      game.gameLog.push(`${CardTitle(sacrifice008.cardId)} was defeated as part of ${CardTitle("LAW_008")}'s action cost.`);
      CreateCreditToken(game.currentGameState, pending.player!, game.gameLog, "LAW_008");
      break;
    }
    case "LAW_008_wd": { // Director Krennic When Deployed — step 1: chose the "another" friendly unit, now pick the enemy target.
      if (!targetPlayId || !pending.player) break;
      const enemy008 = chooseEnemyForPowerDamage("LAW_008_wd_deal", pending.player, targetPlayId, game.currentGameState);
      if (enemy008) return enemy008;
      break;
    }
    case "LAW_008_wd_deal": { // Director Krennic When Deployed — step 2: that unit deals its power to the chosen enemy unit.
      if (!targetPlayId || !pending.sourcePlayId) break;
      dealPowerToEnemy(game.currentGameState, game.gameLog, "Director Krennic", pending.sourcePlayId, targetPlayId);
      break;
    }
    case "SOR_006": { // Action step 1: defeat the chosen friendly unit, then pick a unit to damage.
      if (!targetPlayId) break;
      const sacrifice = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!sacrifice) break;
      defeatUnit(game.currentGameState, game.gameLog, sacrifice);
      updateDefeatedPlayers(game.currentGameState);
      const allAfterSacrifice = [
        ...game.currentGameState.player1.groundArena, ...game.currentGameState.player1.spaceArena,
        ...game.currentGameState.player2.groundArena, ...game.currentGameState.player2.spaceArena,
      ];
      game.gameLog.push(`${CardTitle(sacrifice.cardId)} was defeated as part of ${CardTitle("SOR_006")}'s action cost.`);
      return {
        type: "ability-target",
        cardId: "SOR_006_A2",
        player: pending.player,
        fromPlayIds: allAfterSacrifice.map(u => u.playId),
        continuation: pending.continuation,
      } satisfies AbilityTargetPending;
    }
    case "SOR_006_A2": { // Action step 2: deal 1 damage to chosen unit and draw a card.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_006", targetPlayId, 1, game.gameLog);
      DrawCardForPlayer(game.currentGameState, game.gameLog, pending.player!);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "SOR_006_D": { // When Deployed: take control of chosen damaged non-leader unit.
      if (!targetPlayId) break;
      const controlTarget = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!controlTarget) break;
      transferControl(game.currentGameState, game.gameLog, controlTarget, pending.player!);
      return pending.continuation;
    }
    case "SOR_006_OA": { // On Attack step 1: defeat the chosen friendly unit.
      if (!targetPlayId) break;
      const sacrifice0A = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!sacrifice0A) break;
      const whenDefeated0A = defeatUnit(game.currentGameState, game.gameLog, sacrifice0A);
      updateDefeatedPlayers(game.currentGameState);
      // Rebuild step-2 target list from current state (post-defeat) so the sacrificed unit is excluded.
      const gs0A = game.currentGameState;
      const liveUnits0A = [
        ...gs0A.player1.groundArena, ...gs0A.player1.spaceArena,
        ...gs0A.player2.groundArena, ...gs0A.player2.spaceArena,
      ];
      const step2: PendingResolution = {
        type: "ability-target",
        cardId: "SOR_006_OA2",
        player: pending.player,
        fromPlayIds: liveUnits0A.map(u => u.playId),
        continuation: (pending.continuation as AbilityTargetPending | null)?.continuation ?? null,
      };
      return whenDefeated0A ? injectContinuation(whenDefeated0A, step2) : step2;
    }
    case "SOR_006_OA2": { // On Attack step 2: deal 1 damage to chosen unit and draw a card.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_006", targetPlayId, 1, game.gameLog);
      DrawCardForPlayer(game.currentGameState, game.gameLog, pending.player!);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "TWI_128": {
      if (!targetPlayId) break;
      if (!pending.sourcePlayId) {
        // Step 1: captor chosen — find eligible enemies in the same arena.
        const captor = GetUnitByPlayId(game.currentGameState, targetPlayId);
        if (!captor) break;
        const captorArena = (CardArena(captor.cardId) ?? "Ground") as "Ground" | "Space";
        const enemyPlayer = GetOtherPlayer(pending.player!);
        const enemyArena = captorArena === "Ground"
          ? (GetPlayer(game.currentGameState, enemyPlayer).groundArena as Unit[])
          : (GetPlayer(game.currentGameState, enemyPlayer).spaceArena as Unit[]);
        const eligible = enemyArena.filter(u => !CardIsLeader(u.cardId));
        if (eligible.length === 0) break;
        return {
          type: "ability-target",
          cardId: "TWI_128",
          player: pending.player,
          sourcePlayId: targetPlayId,
          fromPlayIds: eligible.map(u => u.playId),
          continuation: pending.continuation,
        } satisfies AbilityTargetPending;
      }
      // Step 2: capture target chosen.
      const twi128Target = GetUnitByPlayId(game.currentGameState, targetPlayId);
      const twi128Captor = GetUnitByPlayId(game.currentGameState, pending.sourcePlayId);
      if (!twi128Target || !twi128Captor) break;

      removeFromArena(game.currentGameState, twi128Target.playId);

      if (twi128Target.IsTokenUnit()) {
        game.gameLog.push(`${CardTitle(twi128Target.cardId)} was captured and set aside (token).`);
        updateDefeatedPlayers(game.currentGameState);
        return pending.continuation;
      }
      const captureCollector: PlayerId = twi128Target.controller === 1 ? 2 : 1;
      const twi128Bounty = collectBounties(twi128Target, captureCollector, pending.continuation ?? null);

      twi128Target.damage = 0;
      twi128Target.upgrades = [];
      twi128Captor.captives.push(twi128Target);
      game.gameLog.push(`${CardTitle(twi128Captor.cardId)} captured ${CardTitle(twi128Target.cardId)}.`);
      game.currentGameState.roundState.cardsPlayedThisPhase = game.currentGameState.roundState.cardsPlayedThisPhase.filter(e => e.playId !== twi128Target.playId);
      game.currentGameState.roundState.cardsEnteredPlayThisPhase = game.currentGameState.roundState.cardsEnteredPlayThisPhase.filter(e => e.playId !== twi128Target.playId);

      updateDefeatedPlayers(game.currentGameState);
      return twi128Bounty ?? pending.continuation;
    }
    case "SHD_068": {
      if (!targetPlayId) break;
      const targetSHD068 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!targetSHD068) break;
      targetSHD068.upgrades.push({
        cardId: "SOR_T02",
        playId: nextPlayId(game.currentGameState),
        owner: pending.player!,
        controller: pending.player!,
      });
      game.gameLog.push(`Bounty collected: Shield token placed on ${CardTitle(targetSHD068.cardId)}.`);
      return pending.continuation;
    }
    case "JTL_049": {
      if (!targetPlayId || !pending.sourcePlayId) break;
      const l3 = GetUnitByPlayId(game.currentGameState, pending.sourcePlayId);
      const vehicle = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!l3 || !vehicle) break;

      removeFromArena(game.currentGameState, l3.playId);
      for (const upg of l3.upgrades) {
        game.gameLog.push(`${CardTitle(upg.cardId)} on L3-37 was defeated.`);
      }
      for (const captive of l3.captives ?? []) {
        const arena = (CardArena(captive.cardId) ?? "Ground") as "Ground" | "Space";
        const rescued = Unit.FromInterface({ ...captive, ready: false });
        if (arena === "Ground") GetPlayer(game.currentGameState, captive.owner).groundArena.push(rescued);
        else GetPlayer(game.currentGameState, captive.owner).spaceArena.push(rescued);
        game.gameLog.push(`${CardTitle(captive.cardId)} was rescued from L3-37.`);
      }
      vehicle.upgrades.push({
        cardId: "JTL_049",
        playId: nextPlayId(game.currentGameState),
        owner: pending.player!,
        controller: pending.player!,
      });
      game.gameLog.push(`L3-37 attached as a pilot upgrade to ${CardTitle(vehicle.cardId)}.`);

      updateDefeatedPlayers(game.currentGameState);
      const nextPendingL3 = pending.continuation ?? null;
      if (nextPendingL3) return nextPendingL3;
      const bagL3 = drainTriggerBag(game.currentGameState, game.gameLog);
      return bagL3 ?? null;
    }
    // ── SOR_058 Vigilance aspect effects ─────────────────────────────────────
    case "SOR_058_heal_5_base": {
      if (!targetPlayId) break;
      healTarget(game.currentGameState, targetPlayId, 5, game.gameLog, "SOR_058");
      return pending.continuation;
    }
    case "SOR_058_defeat_unit_3hp": {
      if (!targetPlayId) break;
      const target058d = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target058d) break;
      const defPend058 = defeatUnit(game.currentGameState, game.gameLog, target058d);
      game.gameLog.push(`${CardTitle("SOR_058")}: defeated ${CardTitle(target058d.cardId)}.`);
      if (defPend058) return injectContinuation(defPend058, pending.continuation);
      return pending.continuation;
    }
    case "SOR_058_give_shield": {
      if (!targetPlayId) break;
      const target058s = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target058s) {
        target058s.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game.currentGameState), owner: target058s.owner, controller: target058s.controller });
        game.gameLog.push(`${CardTitle("SOR_058")}: gave a Shield token to ${CardTitle(target058s.cardId)}.`);
      }
      return pending.continuation;
    }

    // ── SOR_107 Command aspect effects ───────────────────────────────────────
    case "SOR_107_give_2_xp": {
      if (!targetPlayId) break;
      const target107x = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target107x) {
        target107x.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target107x.owner, controller: target107x.controller });
        target107x.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target107x.owner, controller: target107x.controller });
        game.gameLog.push(`${CardTitle("SOR_107")}: gave 2 Experience tokens to ${CardTitle(target107x.cardId)}.`);
      }
      return pending.continuation;
    }
    case "SOR_107_STEP1": {
      if (!targetPlayId) break;
      const friendly107 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!friendly107) break;
      const nonUniqueEnemies107 = GetAllUnits(game.currentGameState)
        .filter(u => u.controller !== pending.player && !CardIsUnique(u.cardId));
      if (nonUniqueEnemies107.length === 0) return pending.continuation;
      return {
        type: "ability-target",
        cardId: "SOR_107_STEP2",
        player: pending.player,
        sourcePlayId: targetPlayId,
        fromPlayIds: nonUniqueEnemies107.map(u => u.playId),
        continuation: pending.continuation,
      };
    }
    case "SOR_107_STEP2": {
      if (!targetPlayId) break;
      const source107 = GetUnitByPlayId(game.currentGameState, pending.sourcePlayId!);
      if (!source107) break;
      const power107 = Unit.FromInterface(source107).CurrentPower();
      if (power107 > 0) DealDamageToUnit(game.currentGameState, "SOR_107", targetPlayId, power107, game.gameLog);
      game.gameLog.push(`${CardTitle("SOR_107")}: ${CardTitle(source107.cardId)} dealt ${power107} damage to ${CardTitle(GetUnitByPlayId(game.currentGameState, targetPlayId)?.cardId ?? targetPlayId)}.`);
      break;
    }

    // ── SOR_155 Aggression aspect effects ────────────────────────────────────
    case "SOR_155_ready_unit_3pow": {
      if (!targetPlayId) break;
      const target155r = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target155r) {
        target155r.ready = true;
        game.gameLog.push(`${CardTitle("SOR_155")}: readied ${CardTitle(target155r.cardId)}.`);
      }
      return pending.continuation;
    }
    case "SOR_155_deal_4_damage": {
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_155", targetPlayId, 4, game.gameLog);
      break;
    }

    // ── SOR_203 Cunning aspect effects ───────────────────────────────────────
    case "SOR_203_bounce_unit": {
      if (!targetPlayId) break;
      const bounceResult203 = removeFromArena(game.currentGameState, targetPlayId);
      if (!bounceResult203) break;
      const { unit: bounced203 } = bounceResult203;
      if (!bounced203.IsTokenUnit()) {
        GetPlayer(game.currentGameState, bounced203.owner).hand.push({ cardId: bounced203.cardId });
        game.gameLog.push(`${CardTitle("SOR_203")}: returned ${CardTitle(bounced203.cardId)} to Player ${bounced203.owner}'s hand.`);
      }
      return pending.continuation;
    }
    case "SOR_203_buff_4_attack": {
      if (!targetPlayId) break;
      const target203b = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target203b) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_203", duration: "Phase", affectedPlayer: target203b.controller, targetPlayId });
        game.gameLog.push(`${CardTitle("SOR_203")}: gave +4/+0 to ${CardTitle(target203b.cardId)} for this phase.`);
      }
      return pending.continuation;
    }

    case "SEC_264": { // Clandestine Connections — deal 2 damage to the chosen base
      const owner264 = pending.player!;
      // UI sends targetZones:["Base"] (targetIsBase) for the enemy base; tests/back-ends may
      // pass the base playId directly. Support both.
      let basePlayer264: PlayerId | null = null;
      if (targetIsBase) basePlayer264 = owner264 === 1 ? 2 : 1;
      else if (targetPlayId === "player1.base") basePlayer264 = 1;
      else if (targetPlayId === "player2.base") basePlayer264 = 2;
      if (basePlayer264 !== null) {
        dealBaseDamage(game.currentGameState, basePlayer264, 2, owner264);
        game.gameLog.push(`${CardTitle("SEC_264")}: dealt 2 damage to player ${basePlayer264}'s base.`);
      }
      break;
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

function checkMillenniumFalconTax(gs: GameState): AbilityOptionPending | null {
  for (const player of [1, 2] as PlayerId[]) {
    const p = GetPlayer(gs, player);
    const mfUnit = [...p.spaceArena].find(u => u.cardId === "SOR_193" && !Unit.FromInterface(u).LostAbilities());
    if (mfUnit) {
      return {
        type: "ability-option",
        cardId: "SOR_193",
        sourcePlayId: mfUnit.playId,
        player,
        helperText: "Millennium Falcon: Pay 1 resource to keep it, or return it to its owner's hand?",
        yesLabel: "Pay 1",
        noLabel: "Return to Hand",
        onYes: null,
        continuation: null,
      };
    }
  }
  return null;
}

/**
 * Process one GameDispatch message against the current EngineContext.
 *
 * The caller must store the returned context and send it back on the next
 * request. The context is opaque to the UI — it carries pending resolution
 * state and the full game object.
 */
/**
 * A discard-from-hand pending whose target has no cards is unsatisfiable: no card index can
 * ever be valid, so the resolution would hang forever. Nothing to discard is a legal outcome
 * — resolve it as a no-op and move on to whatever comes next.
 *
 * Applied centrally so every card that forces a discard is covered, not just the ones whose
 * handler remembered to check.
 */
function skipUnsatisfiableDiscards(game: GameState, log: string[], result: HandlerResult): HandlerResult {
  let current = result;

  while (
    current.pending?.type === "discard-from-hand" &&
    GetPlayer(game, current.pending.targetPlayer).hand.length === 0
  ) {
    log.push(`Player ${current.pending.targetPlayer} has no cards to discard.`);

    const next = current.pending.continuation ?? null;
    if (next) {
      current = { response: resolutionResponse(pendingToResolution(next, game)), pending: next, stateChanged: current.stateChanged };
      continue;
    }

    const bagPending = drainTriggerBag(game, log);
    if (bagPending) {
      current = { response: resolutionResponse(pendingToResolution(bagPending, game)), pending: bagPending, stateChanged: current.stateChanged };
      continue;
    }

    updateDefeatedPlayers(game);
    current = { response: stateResponse(game), pending: null, stateChanged: true };
  }

  return current;
}

export function processDispatch(
  dispatch: GameDispatch,
  context: EngineContext,
): { response: DispatchResponse; context: EngineContext } {
  return runDispatch(dispatch, context, []);
}

/**
 * Runs one dispatch. `decisions` carries the Credit-spend choices already made for
 * this dispatch's payments (see payResources): a dispatch that needs a decision is
 * run speculatively, rolled back, prompted, and then re-run through here with the
 * answer appended.
 */
function runDispatch(
  dispatch: GameDispatch,
  context: EngineContext,
  decisions: (number | null)[],
): { response: DispatchResponse; context: EngineContext } {
  // 0. Arm the per-dispatch Credit decision state read by payResources.
  creditDecisions = decisions;
  creditPaymentIndex = 0;

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
          if (err) {
            result = { response: invalidResponse(err), pending: null, stateChanged: false };
          } else {
            const mfPending = gs.gamePhase === "ActionPhase" ? checkMillenniumFalconTax(gs) : null;
            result = mfPending
              ? { response: resolutionResponse(pendingToResolution(mfPending, gs)), pending: mfPending, stateChanged: false }
              : { response: stateResponse(gs), pending: null, stateChanged: true };
          }
          break;
        }
        case "pass-resource": {
          const err = tryPassResource(gs, log, dispatch.fromPlayer);
          if (err) {
            result = { response: invalidResponse(err), pending: null, stateChanged: false };
          } else {
            const mfPending = gs.gamePhase === "ActionPhase" ? checkMillenniumFalconTax(gs) : null;
            result = mfPending
              ? { response: resolutionResponse(pendingToResolution(mfPending, gs)), pending: mfPending, stateChanged: false }
              : { response: stateResponse(gs), pending: null, stateChanged: true };
          }
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

      // The player just answered a Credit prompt: throw this run away and re-run the
      // dispatch that raised it, now with the decision recorded. `context.game` is the
      // rolled-back state that dispatch originally started from.
      if (result.creditReplay) {
        const { pending: creditPending, spend } = result.creditReplay;
        const nextDecisions = [...creditPending.decisions];
        nextDecisions[creditPending.paymentIndex] = spend;
        return runDispatch(
          creditPending.replayDispatch,
          { game: context.game, pending: creditPending.replayPending },
          nextDecisions,
        );
      }

      // After a successful top-level action, advance the turn.
      if (isTopLevelAction && !result.response.invalidAction) {
        const wasPass = dispatch.dispatchType === "pass-action" || dispatch.dispatchType === "claim-initiative";
        advanceTurn(gs, log, wasPass);
      }
    }

    if (!result.response.invalidAction) {
      result = skipUnsatisfiableDiscards(gs, log, result);
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
  } catch (err) {
    if (!(err instanceof NeedsCreditDecision)) throw err;

    // A payment needs a Credit decision. Discard every mutation this speculative run
    // made — `context` is the caller's object, which runDispatch clones before touching
    // — and prompt. Answering replays this same dispatch from that untouched state.
    const { paymentIndex, player, sourceCardId, fullCost, maxUseful, minForced } = err.info;
    const priorDecisions: (number | null)[] = [];
    for (let i = 0; i < paymentIndex; i++) priorDecisions[i] = decisions[i] ?? null;

    const creditPending: CreditPaymentOptionPending = {
      type: "credit-payment-option",
      cardId: sourceCardId,
      playingPlayer: player,
      fullCost,
      maxUseful,
      minForced,
      paymentIndex,
      replayDispatch: dispatch,
      replayPending: context.pending,
      decisions: priorDecisions,
    };
    return {
      response: resolutionResponse(pendingToResolution(creditPending, context.game.currentGameState)),
      context: { game: context.game, pending: creditPending },
    };
  } finally {
    SetGame(null);
  }
}
