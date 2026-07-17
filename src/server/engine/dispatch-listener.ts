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
  CardHasWhenDefeated,
  CardHp,
  CardIsUnique,
  CardPower,
  CardSubtitle,
  CardTitle,
  CardTraits,
  CardType,
} from "@/server/engine/card-db/generated";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { SharesKeyword } from "@/server/engine/card-db/keyword-dictionaries.ts/all-keywords";
import { GetAllUnits, ApplyDamagePrevention, CardIsLeader, CardsCanDisclose, DealDamageToUnit, DrawCardForPlayer, GetGame, GetUnitsForPlayer, HasOnAttack, GetOtherPlayer, GetPlayer, SetGame, TraitContains, UnitAttackedThisPhase, UnitWasDefeatedThisPhase, UnitsDefeatedThisPhaseCount, CardWasPlayedThisPhase, GetUnitByPlayId, AllGroundUnits, PlayerHasUnitWithTraitInPlay, PlayerHasUnitWithAspectInPlay, CreateForceToken, UseTheForce, GetLeaderForPlayer, HealBaseForPlayer, GiveStatModForPhase, GivePowerMod, DistinctAspectCount, DistinctAspectsAmongUnits, CanDiscloseAnyOf, SEC_004_ASPECTS, UnitsNotSharingAspectWith, QueueJangoDamageReaction, AttackedThisPhasePlayIds, BaseHealingPrevented, AllCaptives, QueueRancorKeeperReaction, CapBaseDamage, MarkUnitDamaged, ReadyUnitByPlayId } from "@/server/engine/core-functions";
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
import { effectiveSmuggleCost, spendableFor, playCost, pilotPlayCost, uncoveredAspects, regionalGovernorBlocks } from "@/server/engine/card-playability";
import type { Game, GameState } from "@/lib/engine/game";
import type { CardInPlay, CurrentEffect, DiscardedCard, PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";
import { PHASE_STAT_MOD } from "@/lib/engine/core-models";
import type {
  AbilityOptionPending,
  AbilityTargetPending,
  AttackTargetPending,
  DefeatCopyPending,
  DontGetCockyPending,
  DiscardFromHandPending,
  TrenchRevealPending,
  IndirectDamagePending,
  EngineContext,
  ExploitOptionPending,
  ExploitTargetPending,
  CreditPaymentOptionPending,
  CreditPaymentAmountPending,
  ChooseOnePending,
  ThrawnReplayPending,
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
import { resolveWhenPlayed, shatterpointModeA, shatterpointModeB, anakinMortisAbility } from "@/server/engine/actions/when-played";
import { executeRegroupDraw, tryRegroupResource, tryPassResource } from "@/server/engine/actions/regroup";
import { resolveWhenPlayedTrigger, WhenPlayedHasAutoEffect } from "@/server/engine/actions/when-played-trigger";
import { resolveOnAttackTrigger } from "@/server/engine/actions/on-attack";
import { chooseEnemyForPowerDamage, dealPowerToEnemy, dealRemainingHpToEnemy } from "@/server/engine/actions/deal-power-damage";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { AttackAbilityCardIds, HasSupport, SupportGrantEffectCardId } from "@/server/engine/card-db/keyword-dictionaries.ts/support";
import { ActionAbilities, ActionAbilityCost, WeakerThanAFriendlyUnitPlayIds } from "@/server/engine/actions/action-ability";
import { ExploitAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/exploit";
import { PilotingCost } from "@/server/engine/card-db/keyword-dictionaries.ts/piloting";
import { IsTokenUpgrade, PilotingEligibleVehicles, PilotlessVehiclePlayIds, IsPilotUpgrade } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { LeaderDeployPilotThreshold } from "@/server/engine/card-db/keyword-dictionaries.ts/leader-pilot-deploy";
import { HasPlot } from "@/server/engine/card-db/keyword-dictionaries.ts/plot";
import { resolveWhenDeployed } from "@/server/engine/actions/when-deployed";
import { applyDarksaberOnAttack } from "./on-attack-helper";
import { CreateSpy, CreateCreditToken, CreateCloneTrooper, CreateBattleDroid, CreateXWing, DefeatAdvantageTokensAfterCombat, GiveAdvantageTokens } from "@/server/engine/token-helpers";
import { UpgradeHpOf, UpgradePowerOf } from "@/server/engine/card-db/upgrade-stats";
import { UpgradeImmuneToEnemyAbilities, UnitImmuneToEnemyAbilities, PlayerAssignsOwnIndirectDamage, LeaderAbilitiesIgnored, CanUnitAttack, DefeatResource } from "@/server/engine/core-functions";

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
      const upgPow = u.upgrades.reduce((sum, upg) => sum + UpgradePowerOf(upg.cardId), 0);
      const upgHp = u.upgrades.reduce((sum, upg) => sum + UpgradeHpOf(upg.cardId), 0);
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
    case "SHD_197": // L3-37 — rescue the captured card the player picked.
      rescueCaptiveByPlayId(game, log, optionId, "SHD_197");
      break;
    case "LOF_079": // Shatterpoint
      next = optionId === "defeat_low_hp"
        ? shatterpointModeA(pending.cardId, pending.player)
        : shatterpointModeB(pending.cardId, pending.player, log);
      break;
    case "LAW_019": { // Alliance Outpost — the player picked one of the three modes.
      if (optionId === "credit") {
        CreateCreditToken(game, pending.player, log, "LAW_019");
        break;
      }
      const units019 = GetAllUnits(game);
      if (units019.length === 0) break; // nothing to give a token to
      next = {
        type: "ability-target",
        cardId: optionId === "experience" ? "LAW_019_experience" : "LAW_019_shield",
        player: pending.player,
        fromPlayIds: units019.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
      break;
    }
    case "LOF_070": { // Anakin (Champion of Mortis) — the player picked which When Played resolves first.
      const first = optionId === "heroism" ? "heroism" : "villainy";
      const second = first === "heroism" ? "villainy" : "heroism";
      next = anakinMortisAbility(first, pending.player, anakinMortisAbility(second, pending.player, null));
      break;
    }
    case "TWI_004": { // Yoda — put the held card on the top or bottom of the deck.
      const heldCardId = String(pending.data?.heldCardId ?? "");
      if (!heldCardId) break;
      const deck004 = GetPlayer(game, pending.player).deck;
      // The top of the deck is the END of the array (drawing pops).
      if (optionId === "top") deck004.push({ cardId: heldCardId });
      else deck004.unshift({ cardId: heldCardId });
      log.push(`${CardTitle("TWI_004")}: put ${CardTitle(heldCardId)} on the ${optionId} of the deck.`);
      break;
    }
    case "SHD_001": { // Gar Saxon — the player picked which upgrade to return to its owner's hand.
      const cardId001 = String(pending.data?.[optionId] ?? "");
      const owner001 = Number(pending.data?.[`${optionId}_owner`] ?? pending.player) as PlayerId;
      if (cardId001) {
        GetPlayer(game, owner001).hand.push({ cardId: cardId001 });
        log.push(`${CardTitle("SHD_001")}: returned ${CardTitle(cardId001)} to Player ${owner001}'s hand.`);
      }
      break;
    }
    default:
      log.push(`No "Choose one" handler for ${CardTitle(pending.cardId)}.`);
      break;
  }
  return next ? injectContinuation(next, pending.continuation) : pending.continuation;
}

/** Karis Nemik (SEC_148): "create a Spy token and ready it" — tokens spawn exhausted. */
function createReadySpy(gs: GameState, player: PlayerId, log: string[]): void {
  const spy = CreateSpy(gs, player, log, "SEC_148");
  spy.ready = true;
}

/**
 * One unit captures another (CR 8.33): the captive leaves play facedown under the captor,
 * losing its damage and upgrades. Tokens are set aside instead of being held.
 * Shared by Take Captive (TWI_128) and Grand Admiral Thrawn (SEC_193).
 */
function CaptureUnit(
  game: GameState,
  log: string[],
  captor: Unit,
  target: Unit,
  continuation: PendingResolution | null,
): PendingResolution | null {
  removeFromArena(game, target.playId);

  if (target.IsTokenUnit()) {
    log.push(`${CardTitle(target.cardId)} was captured and set aside (token).`);
    updateDefeatedPlayers(game);
    return continuation;
  }

  const collector: PlayerId = target.controller === 1 ? 2 : 1;
  const bounty = collectBounties(target, collector, continuation);

  target.damage = 0;
  target.upgrades = [];
  captor.captives.push(target);
  log.push(`${CardTitle(captor.cardId)} captured ${CardTitle(target.cardId)}.`);
  game.roundState.cardsPlayedThisPhase = game.roundState.cardsPlayedThisPhase.filter(e => e.playId !== target.playId);
  game.roundState.cardsEnteredPlayThisPhase = game.roundState.cardsEnteredPlayThisPhase.filter(e => e.playId !== target.playId);

  updateDefeatedPlayers(game);
  return bounty ?? continuation;
}

/** Enemy non-leader units in the same arena as `captor` — the legal victims of a capture. */
function CaptureVictimPlayIds(game: GameState, captor: Unit): string[] {
  const arena = (CardArena(captor.cardId) ?? "Ground") as "Ground" | "Space";
  const enemy = GetOtherPlayer(captor.controller);
  const enemyArena = arena === "Ground"
    ? (GetPlayer(game, enemy).groundArena as Unit[])
    : (GetPlayer(game, enemy).spaceArena as Unit[]);
  return enemyArena.filter(u => !CardIsLeader(u.cardId) && !UnitImmuneToEnemyAbilities(u.cardId)).map(u => u.playId);
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

/**
 * The 8 common LAW "splash" bases — "Epic Action: Play a card from your hand, ignoring 1 of its
 * Vigilance, Command, Aggression, or Cunning aspect penalties."
 */
const SPLASH_BASES = new Set([
  "LAW_020", //Daimyo's Palace
  "LAW_021", //Coaxium Mine
  "LAW_022", //Aldhani Garrison
  "LAW_024", //Imperial Command Complex
  "LAW_025", //Contested Caverns
  "LAW_027", //Stygeon Spire
  "LAW_028", //Canto Bight
  "LAW_030", //Partisan Hideout
]);

/** The four non-side aspects. Heroism/Villainy penalties can never be splashed away. */
const SPLASHABLE_ASPECTS = ["Vigilance", "Command", "Aggression", "Cunning"];

/**
 * The resource discount a splash base gives when playing `cardId`: 2 if at least one of the
 * card's UNCOVERED aspect icons is one of the four non-side aspects, else 0.
 *
 * Every aspect penalty is worth the same 2 resources, so which icon the player "chooses" to
 * ignore never changes the price — no prompt is needed. A doubled uncovered icon (e.g.
 * Aggression×2) is two separate penalties and only one is ignored, hence a flat 2, not 4.
 */
function splashAspectDiscount(game: GameState, player: PlayerId, cardId: string): number {
  const uncovered = uncoveredAspects(game, player, CardAspects(cardId));
  return uncovered.some(a => SPLASHABLE_ASPECTS.includes(a)) ? 2 : 0;
}

function canAfford(game: GameState, player: PlayerId, cardId: string): boolean {
  const ready = GetPlayer(game, player).resources.filter((r) => r.ready).length;
  return ready >= playCost(game, player, cardId);
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
  amount = CapBaseDamage(player, amount); // ASH_070 At Attin Safety Droid
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
  /** The player whose card ability is doing the defeating, when one is. */
  bySourcePlayer?: PlayerId,
): PendingResolution | null {
  for (const u of GetAllUnits(game)) {
    const upgradeIdx = u.upgrades.findIndex(upg => upg.playId === targetPlayId);
    if (upgradeIdx === -1) continue;
    // "This upgrade can't be defeated by enemy card abilities" (Luke JTL_012 as a Pilot).
    if (
      bySourcePlayer !== undefined &&
      u.controller !== bySourcePlayer &&
      UpgradeImmuneToEnemyAbilities(u.upgrades[upgradeIdx].cardId)
    ) {
      log.push(`${CardTitle(u.upgrades[upgradeIdx].cardId)} can't be defeated by enemy card abilities.`);
      return continuation;
    }
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
  return PilotlessVehiclePlayIds(game, player, l337PlayId);
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
  if (HasSupport(cardId, unit.playId, player)) {
    game.triggerBag.push({ triggerType: "support", cardId, fromPlayer: player, playId: unit.playId, nested });
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

/**
 * JTL_002 Grand Admiral Thrawn — "When you use a 'When Defeated' ability: You may exhaust this
 * leader. If you do, use that ability again." (Deployed: free, but only once each round.)
 *
 * Wraps every When Defeated resolution: the ability resolves first, then Thrawn's prompt is
 * chained on after it. Answering Yes re-runs the SAME ability from a snapshot of the defeated
 * unit — via plain resolveWhenDefeated, so a replay can never chain another Thrawn prompt.
 */
function resolveWhenDefeatedWithThrawn(
  game: GameState,
  unit: Unit,
  player: PlayerId,
): PendingResolution | null {
  const whenDefeated = resolveWhenDefeated(unit, player);
  const thrawn = thrawnReplayPending(game, unit, player);
  if (!thrawn) return whenDefeated;
  if (!whenDefeated) return thrawn;
  // The prompt must come AFTER the ability has been used — chain it onto the end.
  // injectContinuation only threads through pendings that already carry a `continuation`
  // key; several When Defeated pendings leave that optional field off entirely (K-2SO's
  // when-defeated-choice, for one), so seed it before chaining or the prompt is dropped.
  const seeded = "continuation" in whenDefeated && whenDefeated.continuation !== undefined
    ? whenDefeated
    : { ...whenDefeated, continuation: null } as PendingResolution;
  return injectContinuation(seeded, thrawn);
}

/** The Thrawn prompt, or null when he can't (or shouldn't) offer a replay right now. */
function thrawnReplayPending(game: GameState, unit: Unit, player: PlayerId): ThrawnReplayPending | null {
  // "that ability" must exist — a unit with no When Defeated ability gives Thrawn nothing to repeat.
  if (!CardHasWhenDefeated(unit.cardId)) return null;

  const leader = GetPlayer(game, player).leader;
  if (leader.cardId !== "JTL_002") return null;

  if (!leader.deployed) {
    // Leader side: exhausting the leader IS the cost, so an exhausted leader can't pay it.
    if (!leader.ready || LeaderAbilitiesIgnored()) return null;
    return { type: "thrawn-replay", player, defeatedUnit: unit, deployed: false, continuation: null };
  }

  // Deployed side: no cost, but only once each round.
  const usedThisRound = game.currentEffects.some(
    e => e.cardId === "JTL_002_usedThisRound" && e.affectedPlayer === player,
  );
  if (usedThisRound) return null;
  return { type: "thrawn-replay", player, defeatedUnit: unit, deployed: true, continuation: null };
}

function processSingleTrigger(trigger: TriggerEntry, game: GameState, log: string[]): PendingResolution | null {
  if (trigger.triggerType === "when-defeated") {
    const wdCtx = trigger.context as { defeatedUnit?: UnitInterface } | undefined;
    if (!wdCtx?.defeatedUnit) return null;
    const unit = Unit.FromInterface(wdCtx.defeatedUnit);
    return resolveWhenDefeatedWithThrawn(game, unit, trigger.fromPlayer);
  }

  if (trigger.triggerType === "when-played") {
    const nextPending = resolveWhenPlayed(trigger.cardId, trigger.fromPlayer, trigger.playId);
    if (nextPending) return nextPending;
    if (trigger.cardId === "ASH_112") { // Luke Skywalker — if you control 4+ units, deal 3 to each enemy unit.
      if (GetUnitsForPlayer(trigger.fromPlayer).length >= 4) {
        const enemy112: PlayerId = trigger.fromPlayer === 1 ? 2 : 1;
        for (const u of GetUnitsForPlayer(enemy112)) {
          DealDamageToUnit(game, "ASH_112", u.playId, 3, log);
        }
        log.push(`${CardTitle("ASH_112")}: dealt 3 damage to each enemy unit.`);
        return sweepDeadUnits(game, log, null);
      }
      return null;
    }
    resolveWhenPlayedTrigger(trigger, game, log);
    return null;
  }

  if (trigger.triggerType === "use-the-force" && trigger.playId) {
    // LOF_260 The Father — "When you use the Force: You may deal 1 damage to this unit.
    // If you do, the Force is with you."
    const father = GetUnitByPlayId(game, trigger.playId);
    if (!father) return null; // left play before the reaction resolved
    return {
      type: "ability-option",
      cardId: trigger.cardId,
      sourcePlayId: trigger.playId,
      player: trigger.fromPlayer,
      helperText: `Deal 1 damage to ${CardTitle(trigger.cardId)} to return your Force token?`,
      yesLabel: "Deal 1 damage",
      noLabel: "Skip",
      onYes: null,
      continuation: null,
    };
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
    if (!CanUnitAttack(unit)) return null; // a unit that can't attack can't ambush-attack either
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

  if (trigger.triggerType === "support" && trigger.playId) {
    return supportAttackPending(game, trigger.cardId, trigger.playId, trigger.fromPlayer);
  }

  if (trigger.triggerType === "enemy-unit-defeated") {
    switch (trigger.cardId) {
      case "SOR_002": { //Iden Versio - When an enemy unit is defeated: Heal 1 damage from your base.
        if (!BaseHealingPrevented()) { // TWI_132 Confederate Tri-Fighter
          const base = trigger.fromPlayer === 1 ? game.player1.base : game.player2.base;
          base.damage = Math.max(0, base.damage - 1);
        }
        return null;
      }
      case "LOF_130": { // HK-47 — When an enemy unit is defeated: Deal 1 damage to its controller's
                        // base. The defeated unit's controller is the opponent of HK-47's controller.
        const opp130: PlayerId = trigger.fromPlayer === 1 ? 2 : 1;
        dealBaseDamage(game, opp130, 1, trigger.fromPlayer);
        log.push(`${CardTitle("LOF_130")}: dealt 1 damage to player ${opp130}'s base.`);
        return null;
      }
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
      case "ASH_102": { // Ravager: the just-played unit may deal damage equal to its power
                        // to a unit in the same arena (including the Ravager itself).
        const ctx102 = trigger.context as CardPlayedContext | undefined;
        const playedPlayId = ctx102?.playedPlayId;
        if (!playedPlayId) return null;
        const playedUnit = GetUnitByPlayId(game, playedPlayId);
        if (!playedUnit) return null; // it already left play
        const power102 = Unit.FromInterface(playedUnit).CurrentPower();
        if (power102 <= 0) return null;
        // "a unit in the same arena" — as the played unit, either side, itself included.
        const inGround = GetPlayer(game, 1).groundArena.concat(GetPlayer(game, 2).groundArena)
          .some(u => u.playId === playedPlayId);
        const sameArena = inGround
          ? [...GetPlayer(game, 1).groundArena, ...GetPlayer(game, 2).groundArena]
          : [...GetPlayer(game, 1).spaceArena, ...GetPlayer(game, 2).spaceArena];
        return {
          type: "ability-option",
          cardId: "ASH_102",
          player: trigger.fromPlayer,
          helperText: `Have ${CardTitle(playedUnit.cardId)} deal ${power102} damage to a unit in the same arena?`,
          yesLabel: `Deal ${power102}`,
          noLabel: "Skip",
          onYes: {
            type: "ability-target",
            cardId: "ASH_102",
            player: trigger.fromPlayer,
            sourcePlayId: playedPlayId,
            fromPlayIds: sameArena.map(u => u.playId),
            amount: power102,
            continuation: null,
          },
          continuation: null,
        } satisfies AbilityOptionPending;
      }
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

  if (trigger.triggerType === "when-unit-deals-damage") {
    if (trigger.cardId === "TWI_016") { // Jango Fett — exhaust the damaged enemy unit.
      const enemy016 = trigger.playId ? GetUnitByPlayId(game, trigger.playId) : undefined;
      if (!enemy016 || !enemy016.ready) return null; // gone or already exhausted → nothing worth doing
      const leader016 = GetPlayer(game, trigger.fromPlayer).leader;
      const deployed016 = leader016.cardId === "TWI_016" && leader016.deployed;
      // Front side requires exhausting Jango; only offer it while he is ready.
      if (!deployed016 && !(leader016.cardId === "TWI_016" && leader016.ready)) return null;
      return {
        type: "ability-option",
        cardId: "TWI_016",
        player: trigger.fromPlayer,
        sourcePlayId: trigger.playId,
        helperText: deployed016 ? "Exhaust that enemy unit?" : "Exhaust Jango Fett to exhaust that enemy unit?",
        yesLabel: deployed016 ? "Exhaust it" : "Exhaust",
        noLabel: "Skip",
        onYes: null,
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    return null;
  }

  if (trigger.triggerType === "when-unit-takes-damage") {
    if (trigger.cardId === "ASH_032") { // Rancor Keeper — deal 1 damage to any number of bases (once per round).
      const keeper032 = GetUnitsForPlayer(trigger.fromPlayer).find(u => u.cardId === "ASH_032");
      if (!keeper032 || Unit.FromInterface(keeper032).LostAbilities()) return null;
      game.currentEffects.push({ cardId: "ASH_032_usedThisRound", duration: "Round", affectedPlayer: trigger.fromPlayer });
      return {
        type: "ability-target",
        cardId: "ASH_032",
        player: trigger.fromPlayer,
        fromPlayIds: ["player1.base", "player2.base"],
        needsMultiple: true,
        maxTargets: 2,
        continuation: null,
      } satisfies AbilityTargetPending;
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
      case "SOR_015": { // Boba Fett — When an enemy unit leaves play: You may exhaust this leader.
                        // If you do, ready a resource. Skip if there is no exhausted resource to ready.
        const exhausted015 = GetPlayer(game, trigger.fromPlayer).resources.some(r => !r.ready);
        if (!exhausted015) return null;
        return {
          type: "ability-option",
          cardId: "SOR_015",
          player: trigger.fromPlayer,
          helperText: "Exhaust Boba Fett to ready a resource?",
          yesLabel: "Exhaust",
          noLabel: "Skip",
          onYes: null,
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
    const wdPending = resolveWhenDefeatedWithThrawn(game, unit, t.fromPlayer);
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

/**
 * SOR_015 Boba Fett (leader): "When an enemy unit leaves play: You may exhaust this leader. If you
 * do, ready a resource." Queues the optional reaction for the OTHER player when a unit belonging to
 * `leftPlayer` leaves play. Called from every unit-leaves-play recording site (the defeat paths),
 * consistent with how the deployed side reads `cardsLeftPlayThisPhase`.
 */
function queueBobaLeftPlayReaction(game: GameState, leftPlayer: PlayerId): void {
  const opponent: PlayerId = leftPlayer === 1 ? 2 : 1;
  const leader = GetPlayer(game, opponent).leader;
  if (leader.cardId === "SOR_015" && !leader.deployed && leader.ready) {
    game.triggerBag.push({ triggerType: "leader-reaction", cardId: "SOR_015", fromPlayer: opponent, nested: true });
  }
}

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
  queueBobaLeftPlayReaction(game, removed.player);

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
  const whenDefeated = resolveWhenDefeatedWithThrawn(game, unit, removed.player);
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
  queueBobaLeftPlayReaction(game, removed.player);

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
    queueBobaLeftPlayReaction(game, removed.player);

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
  attacker: Unit,
  /**
   * An ability source the attacker is ABOUT to gain but hasn't yet — used when offering Support:
   * eligibility is computed before the grant exists, and the supporter may be what gives the unit
   * a legal target at all (ASH_037 Red Leader's "may attack units in either arena").
   */
  pendingAbilityCardId?: string,
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

  // Attackers that reach outside their own arena. Strafing Gunship (SOR_212) is a space unit that
  // can also hit enemy ground units; Red Leader (ASH_037) "may attack units in either arena", and
  // Support can hand that reach to a unit in either arena — hence the ability-source scan.
  const otherArena = (arena === "Ground" ? p.spaceArena : p.groundArena) as Unit[];
  const abilitySources = [
    ...AttackAbilityCardIds(Unit.FromInterface(attacker)),
    ...(pendingAbilityCardId ? [pendingAbilityCardId] : []),
  ];
  const reachesOtherArena =
    (attacker.cardId === "SOR_212" && arena === "Space" && !Unit.FromInterface(attacker).LostAbilities())
    || abilitySources.includes("ASH_037");

  let finalVisible = visible;
  if (reachesOtherArena) {
    const visibleOther = otherArena.filter(u =>
      !(HasHidden(u.cardId, u.playId, u.controller) && enteredThisPhase.has(u.playId) && !HasSentinel(u.cardId, u.playId, u.controller)),
    );
    finalVisible = [...visible, ...visibleOther];
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
  if (restoreAmount > 0 && !BaseHealingPrevented()) { // TWI_132 Confederate Tri-Fighter
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
  // Babu Frik (LOF_206): for this attack the unit deals damage equal to its remaining HP instead
  // of its power. The ForAttack effect is set when Babu Frik sends it in.
  const dealsHpAsDamage = game.currentEffects.some(
    e => e.cardId === "LOF_206_hp_as_damage" && e.targetPlayId === attacker.playId && e.duration === "ForAttack",
  );
  const atkPower = dealsHpAsDamage ? Math.max(0, attacker.CurrentHP()) : attacker.CurrentPower(true);
  const attackerName = CardTitle(attacker.cardId);

  if (target.type === "base") {
    dealBaseDamage(game, target.player, atkPower, attacker.controller);
    log.push(`${attackerName} attacked the base for ${atkPower} damage.`);
    const willSacrifice = game.currentEffects.some(
      e => e.cardId === "SOR_150_sacrifice" && e.targetPlayId === attacker.playId,
    );
    // JTL_177 Stay on Target grants the attacker "When this unit deals damage to a base: Draw a
    // card." Read the effect BEFORE the ForAttack effects are cleared just below.
    const stayOnTarget177 = atkPower > 0 && game.currentEffects.some(
      e => e.cardId === "JTL_177" && e.targetPlayId === attacker.playId,
    );
    // Capture the attacker's ability sources BEFORE the ForAttack effects are cleared — a Support
    // grant lives in those effects, and the abilities it lent still fire in When Attack Ends.
    const baseAttackSources = AttackAbilityCardIds(Unit.FromInterface(attacker));
    // Clear ForAttack effects scoped to this attacker after the attack resolves
    game.currentEffects = game.currentEffects.filter(
      (e) => !(e.duration === "ForAttack" && e.targetPlayId === attacker.playId),
    );
    // The attacker's attack has ended — its Advantage tokens defeat. This runs BEFORE any
    // "When Attack Ends" ability, so a token granted by one of those survives (ASH_180).
    DefeatAdvantageTokensAfterCombat([attacker], log);
    // ASH_144 Vane's Snub Fighter: "When a friendly unit's attack ends: If it dealt combat damage
    // to a base, give an Advantage token to this unit." Reacts to ANY friendly attack, not just
    // its own — granted after the cleanup above so the token survives even when Vane's is the
    // attacker itself.
    if (atkPower > 0) {
      const vane144 = GetUnitsForPlayer(attacker.controller)
        .find(u => u.cardId === "ASH_144" && !Unit.FromInterface(u).LostAbilities());
      if (vane144) GiveAdvantageTokens(game, vane144, 1, log, "ASH_144");
    }
    if (stayOnTarget177) {
      DrawCardForPlayer(game, log, attacker.controller);
      log.push(`${CardTitle("JTL_177")}: ${attackerName} damaged the base — drew a card.`);
    }
    const whenAttackEnds = resolveWhenAttackEnds(
      game, attacker, pending.continuation ?? null, false, 0,
      atkPower > 0 ? target.player : null, null, baseAttackSources,
    );
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

    // Chewbacca, Loyal Companion (SOR_196 / promo P25_042) — "When this unit is attacked: Ready
    // him." Mandatory, targetless, and unaffected by combat outcome, so it fires inline here at
    // attack declaration (readying before/after damage is equivalent).
    if (
      (defender.cardId === "SOR_196" || defender.cardId === "P25_042") &&
      !Unit.FromInterface(defender).LostAbilities()
    ) {
      if (!defender.ready) {
        defender.ready = true;
        log.push(`${CardTitle(defender.cardId)}: readied himself after being attacked.`);
      }
    }

    // Strafing Gunship (SOR_212): defender gets –2/+0 when attacking a ground unit from space.
    const defenderIsGround212 =
      attacker.cardId === "SOR_212" &&
      !Unit.FromInterface(attacker).LostAbilities() &&
      (game.player1.groundArena.some(u => u.playId === defender.playId) ||
       game.player2.groundArena.some(u => u.playId === defender.playId));

    // ASH_046 Scion Shuttle — "While this unit is attacking, the defending unit gets –1/–1."
    // The HP half matters (it can bring the defender into lethal range), so it is a real stat mod
    // on the defender rather than a local subtraction. Support can grant it, hence the source scan.
    const attackerSources = AttackAbilityCardIds(Unit.FromInterface(attacker));
    if (attackerSources.includes("ASH_046")) {
      game.currentEffects.push({
        cardId: PHASE_STAT_MOD,
        duration: "ForAttack",
        affectedPlayer: defender.controller,
        targetPlayId: defender.playId,
        value: -1,
      });
      log.push(`${CardTitle("ASH_046")}: gave –1/–1 to ${CardTitle(defender.cardId)} for this attack.`);
    }

    const defPower = Math.max(0, defender.CurrentPower(false, true) - (defenderIsGround212 ? 2 : 0));

    // SOR_071 Electrostaff: while attached unit is defending, attacker gets –1/–0.
    const electrostaffModifier = defender.upgrades.some(u => u.cardId === "SOR_071") ? 1 : 0;
    // ASH_241 Marrok's Fiend Fighter — "This unit gets +2/+0 while attacking a damaged unit."
    // Defender-dependent, so it can't live in CurrentPower(); Support can grant it, so the check
    // runs over every ability source the attacker has for this attack.
    const damagedDefenderBonus = defender.IsDamaged()
      && AttackAbilityCardIds(Unit.FromInterface(attacker)).includes("ASH_241") ? 2 : 0;
    // Shien Flurry prevention on the DEFENDER reduces the attacker's damage before the Shield.
    const effectiveAtkPower = ApplyDamagePrevention(
      game, defender.playId,
      Math.max(0, atkPower + damagedDefenderBonus - electrostaffModifier),
      log,
    );
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

    // First strike: attacker deals damage first; if defender is defeated, no counter-damage.
    // Granted by SOR_217, or printed on ASH_202 Carson Teva ("While attacking, this unit deals
    // combat damage before the defender") — which Support can hand to another attacker.
    const hasFirstStrike = attackerSources.includes("ASH_202") || game.currentEffects.some(
      e => e.cardId === "SOR_217_first_strike" && e.targetPlayId === attacker.playId && e.duration === "ForAttack",
    );

    // Shield token absorbs the first instance of damage to the defender.
    const shieldIdx = defender.upgrades.findIndex(u => u.cardId === "SOR_T02");
    if (shieldIdx !== -1) {
      defender.upgrades.splice(shieldIdx, 1);
      log.push(`${defenderName}'s Shield token was defeated, preventing ${effectiveAtkPower} damage.`);
    } else {
      defender.damage += effectiveAtkPower;
      if (effectiveAtkPower > 0) MarkUnitDamaged(game, defender.playId);
    }

    // If first strike is active and defender is now defeated, counter-damage is 0.
    // Shien Flurry prevention on the ATTACKER reduces the counter-damage before its Shield.
    const effectiveDefPower = ApplyDamagePrevention(
      game, attacker.playId,
      hasFirstStrike && defender.CurrentHP() <= 0 ? 0 : defPower,
      log,
    );
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
      MarkUnitDamaged(game, attacker.playId);
    }
    log.push(`${attackerName} attacked ${defenderName}.`);

    // Jango Fett (TWI_016): when a friendly unit deals combat damage to an enemy unit. Both the
    // attacker→defender hit and the defender→attacker counter are "a friendly unit deals damage".
    if (shieldIdx === -1 && effectiveAtkPower > 0) QueueJangoDamageReaction(game, attacker.controller, defender.playId);
    if (attackerShieldIdx === -1 && effectiveDefPower > 0) QueueJangoDamageReaction(game, defender.controller, attacker.playId);

    // Rancor Keeper (ASH_032): "When a friendly unit is dealt damage and survives" — combat path.
    if (shieldIdx === -1 && effectiveAtkPower > 0) QueueRancorKeeperReaction(game, defender);
    if (attackerShieldIdx === -1 && effectiveDefPower > 0) QueueRancorKeeperReaction(game, attacker);

    // A Shield token absorbs the entire damage instance, so no combat damage
    // reaches the defender and there is no excess for Overwhelm to spill.
    const excessDamage = shieldIdx === -1 ? Math.max(effectiveAtkPower - defHpBefore, 0) : 0;

    // The unit this attack actually dealt combat damage to (a Shield absorbs the whole instance,
    // so nothing lands). ASH_101 The Great Mothers defeats what it damaged, survivors included.
    const combatDamagedPlayId = shieldIdx === -1 && effectiveAtkPower > 0 ? defender.playId : null;

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

    // Clear ForAttack effects scoped to this attack — on the attacker, and on the defender (an
    // attacker's ability can debuff it "while this unit is attacking", e.g. ASH_046 Scion Shuttle).
    // Safe here: defDefeated/atkDefeated are already decided above, so removing a –X/–X can't
    // resurrect a unit that combat killed.
    game.currentEffects = game.currentEffects.filter(
      (e) => !(e.duration === "ForAttack"
        && (e.targetPlayId === attacker.playId || e.targetPlayId === defender.playId)),
    );
    if (willSacrificeUnit && attacker.CurrentHP() > 0) {
      log.push(`Heroic Sacrifice: ${attackerName} is defeated after dealing combat damage.`);
    }

    // The attacker's attack and the defender's defense have both ended — their Advantage
    // tokens defeat. Advantage is +1/+0, so removing it can't change who was defeated above.
    DefeatAdvantageTokensAfterCombat([attacker, defender], log);

    // Resolve defeats (defender first per SWU rules)
    let nextPending: PendingResolution | null = null;
    if (defDefeated) nextPending = defeatUnit(game, log, defender) ?? nextPending;
    if (atkDefeated) nextPending = defeatUnit(game, log, attacker) ?? nextPending;
    if (nextPending) {
      // Append resolveWhenAttackEnds at the tail of the pending chain.
      // defeatUnit returns BountyPending | WhenDefeatedChoicePending, both have continuation.
      const whenAttackEnds = resolveWhenAttackEnds(game, attacker, pending.continuation ?? null, defDefeated, excessDamage, null, combatDamagedPlayId, attackerSources);
      type WithContinuation = { continuation: PendingResolution | null | undefined };
      let tail: WithContinuation = nextPending as unknown as WithContinuation;
      while (tail.continuation != null) tail = tail.continuation as unknown as WithContinuation;
      tail.continuation = whenAttackEnds;
      return nextPending;
    }

    return resolveWhenAttackEnds(game, attacker, pending.continuation ?? null, defDefeated, excessDamage, null, combatDamagedPlayId, attackerSources);
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
  /** The opponent whose BASE took combat damage from this attack, if any (ASH_183). Overwhelm
   *  spill is not combat damage to the base, so it never sets this. */
  baseDamagedPlayer: PlayerId | null = null,
  /** The defending unit this attack dealt combat damage to, if any (ASH_101). */
  combatDamagedPlayId: string | null = null,
  /**
   * The attacker's ability sources, captured BEFORE the attack's ForAttack effects were cleared —
   * a Support grant is one of those effects, and the abilities it lent must still fire here.
   */
  abilitySources: string[] | null = null,
): PendingResolution | null {
  // Darth Revan (LOF_017) — controller-level reaction to ANY friendly unit attacking and
  // defeating a unit. It resolves before the attacker's own When-Attack-Ends ability.
  // Front side: "you may exhaust this leader" is the cost (so only offer when ready);
  // deployed side: no exhaust cost.
  if (defDefeated && GetUnitByPlayId(game, attacker.playId)) {
    const leader = GetLeaderForPlayer(attacker.controller);
    if (leader.cardId === "LOF_017" && (leader.deployed || leader.ready)) {
      const rest = attackerOwnWhenAttackEnds(game, attacker, continuation, defDefeated, excessDamage, baseDamagedPlayer, combatDamagedPlayId, abilitySources);
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
  return attackerOwnWhenAttackEnds(game, attacker, continuation, defDefeated, excessDamage, baseDamagedPlayer, combatDamagedPlayId, abilitySources);
}

function attackerOwnWhenAttackEnds(
  game: GameState,
  attacker: Unit,
  continuation: PendingResolution | null,
  defDefeated: boolean = false,
  excessDamage: number = 0,
  baseDamagedPlayer: PlayerId | null = null,
  combatDamagedPlayId: string | null = null,
  abilitySources: string[] | null = null,
): PendingResolution | null {
  // If attacker was defeated, no trigger fires
  if (!GetUnitByPlayId(game, attacker.playId)) return continuation;

  // Upgrade-granted When-Attack-Ends abilities
  for (const upgrade of attacker.upgrades) {
    switch (upgrade.cardId) {
      case "ASH_183": { // Whistling Birds — "When Attack Ends: If this unit dealt combat damage to
                        // an opponent's base, deal 2 damage to each unit that opponent controls in
                        // this unit's arena."
        if (baseDamagedPlayer === null || baseDamagedPlayer === attacker.controller) break;
        const arena183 = (CardArena(attacker.cardId) ?? "Ground") as "Ground" | "Space";
        const victimState = GetPlayer(game, baseDamagedPlayer);
        const victims183 = arena183 === "Ground" ? victimState.groundArena : victimState.spaceArena;
        const log183 = GetGame()?.gameLog ?? [];
        for (const victim of [...victims183]) {
          DealDamageToUnit(game, "ASH_183", victim.playId, 2, log183);
        }
        updateDefeatedPlayers(game);
        return sweepDeadUnits(game, log183, continuation);
      }
      case "JTL_197": { // Anakin Skywalker (pilot) — "When attached unit completes an attack (and
                        // survives): You may return this upgrade to its owner's hand."
                        // The early return above already guarantees the attacker survived.
        return {
          type: "ability-option",
          cardId: "JTL_197",
          player: attacker.controller,
          sourcePlayId: upgrade.playId,
          helperText: `Return ${CardTitle("JTL_197")} to its owner's hand?`,
          yesLabel: "Return to hand",
          noLabel: "Leave attached",
          onYes: null,
          continuation,
        } satisfies AbilityOptionPending;
      }
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

  // The attacker's own When Attack Ends, plus any it gained from a Support unit for this attack.
  // A source with no such ability returns null; one whose ability fizzles returns `continuation`,
  // which must not stop the other source from resolving.
  for (const sourceCardId of abilitySources ?? AttackAbilityCardIds(Unit.FromInterface(attacker))) {
    const pending = innateWhenAttackEnds(
      sourceCardId, game, attacker, continuation, defDefeated, excessDamage, combatDamagedPlayId,
    );
    if (pending !== null && pending !== continuation) return pending;
  }
  return continuation;
}

/**
 * Resolves the When Attack Ends ability printed on `sourceCardId`, applied to `attacker`.
 * `sourceCardId` is the supporter's cardId when the attacker gained its abilities via Support.
 * Returns null when `sourceCardId` has no When Attack Ends ability at all.
 */
function innateWhenAttackEnds(
  sourceCardId: string,
  game: GameState,
  attacker: Unit,
  continuation: PendingResolution | null,
  defDefeated: boolean,
  excessDamage: number,
  combatDamagedPlayId: string | null,
): PendingResolution | null {
  const log = GetGame()?.gameLog ?? [];
  switch (sourceCardId) {
    case "ASH_033": { // Grand Admiral Thrawn — "When Attack Ends: If the defending unit was
                      // defeated, ready this unit."
      if (defDefeated) {
        attacker.ready = true;
        log.push(`${CardTitle("ASH_033")}: readied ${CardTitle(attacker.cardId)}.`);
      }
      return continuation;
    }
    case "LOF_016": { // Qui-Gon Jinn — "When this unit completes an attack (and survives): You may
                      // return a friendly non-leader unit to its owner's hand. Play a non-Villainy
                      // unit that costs less than the returned unit from your hand for free."
                      // The early return at the top guarantees the attacker survived.
      const friendly016 = GetUnitsForPlayer(attacker.controller).filter(u => !CardIsLeader(u.cardId));
      if (friendly016.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: "LOF_016",
        player: attacker.controller,
        helperText: "Return a friendly non-leader unit and play a cheaper non-Villainy unit for free?",
        yesLabel: "Return & play",
        noLabel: "Skip",
        onYes: buildQuiGonReturn(game, attacker.controller, continuation),
        continuation,
      };
    }
    case "ASH_223": { // Halo — "When Attack Ends: If the defending unit was defeated, give a Shield
                      // token to this unit."
      if (defDefeated) {
        attacker.upgrades.push({
          cardId: "SOR_T02",
          playId: nextPlayId(game),
          owner: attacker.controller,
          controller: attacker.controller,
        });
        log.push(`${CardTitle("ASH_223")}: gave a Shield token to ${CardTitle(attacker.cardId)}.`);
      }
      return continuation;
    }
    case "ASH_036": { // Rukh — "When Attack Ends: If the defending unit was defeated, you may give
                      // 3 Advantage tokens to a unit."
      if (!defDefeated) return continuation;
      const allUnits036 = GetAllUnits(game);
      if (allUnits036.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: "ASH_036",
        player: attacker.controller,
        helperText: "Give 3 Advantage tokens to a unit?",
        yesLabel: "Give 3 Advantage",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "ASH_036",
          player: attacker.controller,
          fromPlayIds: allUnits036.map(u => u.playId),
          continuation,
        },
        continuation,
      };
    }
    case "ASH_101": { // The Great Mothers — "When Attack Ends: If this unit dealt combat damage to
                      // 1 or more non-leader units, defeat those units."
      if (!combatDamagedPlayId) return continuation;
      const damaged101 = GetUnitByPlayId(game, combatDamagedPlayId);
      // Already dead from combat, or a leader → nothing left to defeat.
      if (!damaged101 || CardIsLeader(damaged101.cardId)) return continuation;
      log.push(`${CardTitle("ASH_101")}: defeated ${CardTitle(damaged101.cardId)}.`);
      const defeat101 = defeatUnit(game, log, damaged101);
      if (defeat101) {
        type WithContinuation = { continuation: PendingResolution | null | undefined };
        let tail = defeat101 as unknown as WithContinuation;
        while (tail.continuation != null) tail = tail.continuation as unknown as WithContinuation;
        tail.continuation = continuation;
        return defeat101;
      }
      return sweepDeadUnits(game, log, continuation);
    }
    case "SOR_149": { // Mace Windu — when attacks and defeats a unit: Ready him.
      if (defDefeated && !Unit.FromInterface(attacker).LostAbilities()) {
        attacker.ready = true;
      }
      return continuation;
    }
    case "LOF_063": { // Oggdo Bogdo — when attacks and defeats a unit: heal 2 damage from this unit.
      if (defDefeated && !Unit.FromInterface(attacker).LostAbilities()) {
        attacker.damage = Math.max(0, attacker.damage - 2);
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
    case "SOR_015": { // Boba Fett (deployed): When this unit completes an attack: If an enemy unit
                      // left play this phase, ready up to 2 resources. (Attacker survival is already
                      // guaranteed by the early return above.)
      const opp015: PlayerId = attacker.controller === 1 ? 2 : 1;
      if (!UnitWasDefeatedThisPhase(opp015)) return continuation;
      let readied015 = 0;
      for (const r of GetPlayer(game, attacker.controller).resources) {
        if (readied015 >= 2) break;
        if (!r.ready) { r.ready = true; readied015++; }
      }
      if (readied015 > 0) log.push(`${CardTitle("SOR_015")}: readied ${readied015} resource(s).`);
      return continuation;
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
      return null; // this source has no innate When Attack Ends ability
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
      // A unit can only attack the ENEMY base, never its own — restrict the base target so the UI
      // doesn't offer both. ("A base" ability targets leave baseTargetPlayers undefined = either.)
      const enemyOfAttacker: PlayerId = attacker.controller === 1 ? 2 : 1;
      return {
        type: "Target",
        fromPlayIds: unitPlayIds.length > 0 ? unitPlayIds : undefined,
        fromZones: allowBase ? ["Base"] : undefined,
        baseTargetPlayers: allowBase ? [enemyOfAttacker] : undefined,
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
    case "hand-to-deck":
      return {
        type: "Target",
        fromZones: ["Hand"],
        handOwner: pending.player,
      } satisfies NeedsTarget;
    case "thrawn-replay":
      return {
        type: "Option",
        helperText: pending.deployed
          ? `Use ${CardTitle(pending.defeatedUnit.cardId)}'s When Defeated ability again? (once each round)`
          : `Exhaust ${CardTitle("JTL_002")} to use ${CardTitle(pending.defeatedUnit.cardId)}'s When Defeated ability again?`,
        options: ["Yes", "No"],
        yesLabel: pending.deployed ? "Use it again" : "Exhaust leader",
        noLabel: "Skip",
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
    case "spread-tokens":
      // Reuses the SpreadDamage prompt shape: the client assigns counts per unit.
      return {
        type: "SpreadDamage",
        totalDamage: pending.totalTokens,
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
        // The victim assigns indirect damage — unless the dealer controls a Devastator
        // (JTL_143: "You assign all indirect damage you deal to opponents").
        assigningPlayer:
          pending.targetPlayer !== pending.sourcePlayer && PlayerAssignsOwnIndirectDamage(pending.sourcePlayer)
            ? pending.sourcePlayer
            : pending.targetPlayer,
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
    case "trench-reveal":
      return {
        type: "RevealDiscard",
        helperText: pending.stage === "opponent-discard"
          ? `${CardTitle(pending.cardId)}: opponent — choose 2 of the revealed cards to discard.`
          : `${CardTitle(pending.cardId)}: choose 1 of the remaining cards to draw; the other is discarded.`,
        choices: pending.revealed.map(c => ({ tempId: c.tempId, cardId: c.cardId })),
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

/**
 * Auto (no-input) On Attack abilities that act on the defending unit before combat. They live here
 * rather than in on-attack.ts because they need the engine's defeat plumbing (upgrade defeat,
 * dead-unit sweep). Runs once per ability source, so Support grants them like any other On Attack.
 */
function applyAutoOnAttackEffects(
  game: GameState,
  log: string[],
  attacker: Unit,
  target: ResolveAttackPending["target"],
): void {
  // ASH_083 Summa-verminoth — "On Attack: Defeat all other space units." Target-agnostic (applies
  // to both sides, regardless of whether the declared target is a unit or a base), so it is
  // checked before the unit-target gate below. If the declared defender is a space unit, it is
  // defeated here too — resolveAttack already handles a defender that has left play (returns null).
  if (AttackAbilityCardIds(attacker).includes("ASH_083")) {
    const otherSpaceUnits083 = [...game.player1.spaceArena, ...game.player2.spaceArena]
      .filter(u => u.playId !== attacker.playId);
    for (const u of otherSpaceUnits083) {
      const unit083 = GetUnitByPlayId(game, u.playId);
      // bypassL337: this is a no-input auto-effect, so JTL_049's "move to a Vehicle instead"
      // replacement prompt can't be offered here — force the actual defeat.
      if (unit083) defeatUnit(game, log, unit083, true);
    }
    if (otherSpaceUnits083.length > 0) {
      log.push(`${CardTitle("ASH_083")}: defeated all other space units.`);
      updateDefeatedPlayers(game);
    }
  }

  if (target.type !== "unit") return;
  const defenderPlayId = target.playId;
  let applied = false;

  for (const sourceCardId of AttackAbilityCardIds(attacker)) {
    switch (sourceCardId) {
      case "ASH_156": { // R5-D4 — "On Attack: Defeat all upgrades on the defending unit."
        const defender156 = GetUnitByPlayId(game, defenderPlayId);
        if (!defender156) break;
        for (const upgrade of [...defender156.upgrades]) {
          defeatUpgradeByPlayId(game, log, upgrade.playId, CardTitle("ASH_156"), null, attacker.controller);
        }
        applied = true;
        break;
      }
      case "ASH_168": { // Migs Mayfeld — "On Attack: Deal 1 damage to the defending unit. If this
                        // unit is upgraded, deal 2 damage to the defending unit instead."
        const amount168 = attacker.upgrades.length > 0 ? 2 : 1;
        DealDamageToUnit(game, "ASH_168", defenderPlayId, amount168, log);
        applied = true;
        break;
      }
      default: break;
    }
  }

  // Only sweep when one of the effects above ran: a defender killed before combat must leave play,
  // so the attack finds no target rather than trading damage with a dead unit. Sweeping
  // unconditionally would also defeat unrelated units that are already at 0 HP.
  if (!applied) return;
  sweepDeadUnits(game, log, null);
  updateDefeatedPlayers(game);
}

/**
 * Support — "When you play this unit (or deploy this leader), you may attack with another unit.
 * It gains this unit's other abilities for this attack."
 *
 * Builds the optional prompt and the "choose which unit attacks" step. The ability grant itself is
 * applied when the attacker is chosen (see the "support" case in applyAbilityEffect).
 * Returns null when no other friendly unit could attack — the keyword then simply fizzles.
 */
function supportAttackPending(
  game: GameState,
  supporterCardId: string,
  supporterPlayId: string,
  player: PlayerId,
): PendingResolution | null {
  const eligible = (GetUnitsForPlayer(player) as Unit[]).filter(u => {
    if (u.playId === supporterPlayId) return false; // "another unit"
    if (!CanUnitAttack(u)) return false;
    const { unitPlayIds, includesBase } = computeAttackTargets(game, u, supporterCardId);
    return unitPlayIds.length > 0 || includesBase;
  });
  if (eligible.length === 0) return null;

  return {
    type: "ability-option",
    cardId: "support",
    sourcePlayId: supporterPlayId,
    player,
    helperText: `${CardTitle(supporterCardId)} has Support — attack with another unit?`,
    yesLabel: "Attack",
    noLabel: "Skip",
    onYes: {
      type: "ability-target",
      cardId: "support",
      sourcePlayId: supporterPlayId,
      player,
      fromPlayIds: eligible.map(u => u.playId),
      continuation: null,
    },
    continuation: null,
  };
}

/** Builds the "choose a base" step of Darth Vader's leader ability (1 damage to a base). */
/**
 * LOF_009 Darth Maul — "Deal 1 damage to a unit and 1 damage to a different unit." Two sequential
 * single-target steps; the second excludes the first. Used by both the leader Action and the
 * deployed On Attack (the On Attack passes the combat continuation).
 */
function buildMaulSpread(game: GameState, player: PlayerId, continuation: PendingResolution | null): PendingResolution | null {
  const units = GetAllUnits(game);
  if (units.length === 0) return continuation;
  return {
    type: "ability-target",
    cardId: "LOF_009_a",
    player,
    fromPlayIds: units.map(u => u.playId),
    continuation,
  } satisfies AbilityTargetPending;
}

/**
 * LOF_016 Qui-Gon Jinn — the "return a friendly non-leader unit, then play a cheaper non-Villainy
 * unit for free" sequence. Returns the return-target step, or the continuation if there is no
 * eligible unit to return. Shared by the leader Action and the deployed When-Attack-Ends trigger.
 */
function buildQuiGonReturn(game: GameState, player: PlayerId, continuation: PendingResolution | null): PendingResolution | null {
  const friendly = GetUnitsForPlayer(player).filter(u => !CardIsLeader(u.cardId));
  if (friendly.length === 0) return continuation;
  return {
    type: "ability-target",
    cardId: "LOF_016_return",
    player,
    fromPlayIds: friendly.map(u => u.playId),
    continuation,
  } satisfies AbilityTargetPending;
}

function vaderBaseTargetPending(player: PlayerId): AbilityTargetPending {
  return {
    type: "ability-target",
    cardId: "SOR_010_leader_base",
    player,
    fromPlayIds: [],
    fromZones: ["Base"],
    continuation: null,
  };
}

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
/**
 * ASH_102 Ravager: "When you play a unit: You may have it deal damage equal to its power to a
 * unit in the same arena." Fires only for units YOU play, and never off the Ravager's own entry
 * (its ability isn't active until it is already in play).
 */
function queueRavagerReactions(game: GameState, player: PlayerId, playedPlayId: string, nested: boolean): void {
  const ravagers = [...GetPlayer(game, player).groundArena, ...GetPlayer(game, player).spaceArena]
    .filter(u => u.cardId === "ASH_102" && u.playId !== playedPlayId && !Unit.FromInterface(u).LostAbilities());
  for (const ravager of ravagers) {
    game.triggerBag.push({
      triggerType: "card-played-reaction",
      cardId: "ASH_102",
      fromPlayer: player,
      playId: ravager.playId,
      nested,
      context: { playedCardCost: 0, cardPlayer: player, playedPlayId },
    });
  }
}

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
  if (yularenUnit && CardAspects(cardId).includes("Command") && !BaseHealingPrevented()) { // TWI_132 Confederate Tri-Fighter
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
    // Shien Flurry (LOF_220) grants the played unit both a phase-long Ambush (the injected effect)
    // and a one-shot "prevent 2 of the next damage this phase" — a separate effect because it is
    // consumed on the first damage instance rather than lasting the whole phase.
    if (opts.injectEffect.cardId === "LOF_220") {
      game.currentEffects.push({
        cardId: "LOF_220_prevent",
        duration: "Phase",
        affectedPlayer: opts.injectEffect.affectedPlayer,
        targetPlayId: unit.playId,
        value: 2,
      });
    }
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

  // ASH_102 Ravager: "When you play a unit" — your own Ravagers react to this unit entering.
  queueRavagerReactions(game, player, unit.playId, nested);

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

  if (HasSupport(cardId, unit.playId, player)) {
    game.triggerBag.push({ triggerType: "support", cardId: unit.cardId, fromPlayer: player, playId: unit.playId, nested });
  }

  if (hasAmbush && CardHasWhenPlayed(unit.cardId)) {
    // Both Ambush and When Played — put both in bag for player to choose ordering.
    // Add WhenPlayed if it has interactive targets (non-null preview) OR is a no-input
    // auto-effect (e.g. TWI_112 Subjugating Starfighter's "create a Battle Droid token");
    // a preview-null auto-effect must still fire, so it can't be skipped like a true no-op.
    const whenPlayedPreview = resolveWhenPlayed(unit.cardId, player, unit.playId);
    if (whenPlayedPreview !== null || WhenPlayedHasAutoEffect(unit.cardId)) {
      game.triggerBag.push({ triggerType: "when-played", cardId: unit.cardId, fromPlayer: player, playId: unit.playId, nested });
    }
    // If WhenPlayed has no targets and no auto-effect, skip adding it — Ambush proceeds alone.
  } else if (!hasAmbush && CardHasWhenPlayed(unit.cardId)) {
    const whenPlayedPending = resolveWhenPlayed(unit.cardId, player, unit.playId);
    if (whenPlayedPending && !deferWhenPlayed) {
      // Interactive WP — hand back to the caller to present immediately; it implicitly
      // takes priority over outer bag triggers.
      return whenPlayedPending;
    }
    // A null pending means either "auto-resolving WP" or "WP that can't do anything right
    // now" (e.g. LOF_048 with no Force token). Only the former is worth bagging — bagging a
    // no-op would make the player order it against the unit's Shielded/other triggers.
    if (whenPlayedPending === null && !WhenPlayedHasAutoEffect(unit.cardId)) {
      return null;
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

  // LOF_005 Morgan Elsbeth: "the NEXT unit you play this phase" — consume on the next unit played,
  // whether or not it qualified for the keyword-sharing discount.
  if (CardType(cardId) === "Unit") {
    const morganIdx = game.currentEffects.findIndex(e => e.cardId === "LOF_005" && e.affectedPlayer === player);
    if (morganIdx !== -1) game.currentEffects.splice(morganIdx, 1);
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
      } else if (cardId === "SOR_043" || cardId === "TWI_078" || cardId === "LAW_044") {
        const otherPlayer: PlayerId = player === 1 ? 2 : 1;
        // Snapshot trigger-holders before any unit is removed so wiped units still trigger.
        const holdersP1 = GetUnitsForPlayer(1);
        const holdersP2 = GetUnitsForPlayer(2);
        const enemyUnits = GetUnitsForPlayer(otherPlayer);
        const toDefeat = cardId === "TWI_078"
          ? [...enemyUnits]
          : [...enemyUnits, ...GetUnitsForPlayer(player)]; // SOR_043 / LAW_044 wipe both sides
        // LAW_044 Single Reactor Ignition: "For each enemy unit defeated this way, deal 1
        // damage to its controller's base." Counted before the wipe; friendly losses deal none.
        const enemyDefeated044 = cardId === "LAW_044" ? enemyUnits.length : 0;
        boardWipeDefeat(game, log, toDefeat, holdersP1, holdersP2);
        if (enemyDefeated044 > 0) {
          dealBaseDamage(game, otherPlayer, enemyDefeated044, player);
          log.push(`${CardTitle("LAW_044")}: dealt ${enemyDefeated044} damage to Player ${otherPlayer}'s base (1 per enemy unit defeated).`);
        }
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
  return playCardFromHand(game, log, dispatch.fromPlayer, cardId);
}

/**
 * The shared "play this card out of hand" path: affordability, Piloting, Exploit, Bamboozle,
 * payment (Credits included), then completePlayCard.
 *
 * `costDelta` is a one-off reduction applied to BOTH the unit cost and the piloting cost — used
 * by abilities that play a card at a discount (e.g. the LAW splash bases, which ignore one
 * aspect penalty). It never reduces a cost below 0.
 */
function playCardFromHand(
  game: GameState,
  log: string[],
  player: PlayerId,
  cardId: string,
  costDelta = 0,
): HandlerResult {
  const hand = GetPlayer(game, player).hand;
  const idx = hand.findIndex((c) => c.cardId === cardId);

  if (idx === -1)
    return { response: invalidResponse(`Card ${cardId} not found in Player ${player}'s hand.`), pending: null, stateChanged: false };

  if (regionalGovernorBlocks(game, player, cardId))
    return { response: invalidResponse(`Regional Governor prevents playing ${CardTitle(cardId) ?? cardId}.`), pending: null, stateChanged: false };

  const fullCost = Math.max(0, playCost(game, player, cardId) - costDelta);
  const exploitAmt = ExploitAmount(cardId, "hand", player, true); // report mode: peek without consuming
  const readyCount = spendableFor(game, player);
  const minCost = exploitAmt > 0 ? Math.max(0, fullCost - exploitAmt * 2) : fullCost;

  // --- Piloting branch (checked before the unit affordability guard) ---
  const pilotBase = PilotingCost(cardId);
  if (pilotBase >= 0) {
    const pilotCost = Math.max(0, pilotPlayCost(game, player, cardId) - costDelta);
    const eligibleVehicles = PilotingEligibleVehicles(game, player, cardId);
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
  if (!CanUnitAttack(attacker))
    return { response: invalidResponse(`${CardTitle(attacker.cardId)} can't attack.`), pending: null, stateChanged: false };

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
  // A unit can only attack the ENEMY base — restrict the base target so the UI doesn't offer both.
  const enemyOfAttacker: PlayerId = attacker.controller === 1 ? 2 : 1;
  return {
    response: resolutionResponse({
      type: "Target",
      fromPlayIds: unitPlayIds.length > 0 ? unitPlayIds : undefined,
      fromZones: includesBase ? ["Base"] : undefined,
      baseTargetPlayers: includesBase ? [enemyOfAttacker] : undefined,
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

  if (SPLASH_BASES.has(base.cardId)) return resolveSplashEpicAction(game, log, player);

  switch (base.cardId) {
    case "SOR_022": return resolveEclEpicAction(game, log, player);
    case "SOR_025": return resolveTarkintownEpicAction(game, log, player);
    case "SOR_028": return resolveJedhaCityEpicAction(game, log, player);
    case "LAW_019": return resolveAllianceOutpostEpicAction(game, log, player);
    default: return { response: invalidResponse("This base has no implemented epic action."), pending: null, stateChanged: false };
  }
}

/**
 * The 8 LAW splash bases — "Epic Action: Play a card from your hand, ignoring 1 of its
 * Vigilance, Command, Aggression, or Cunning aspect penalties."
 *
 * Any card in hand is a legal choice (the discount is a benefit, not a requirement); it just has
 * to be affordable once the splash discount is applied.
 */
function resolveSplashEpicAction(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const base = GetPlayer(game, player).base;
  base.epicActionUsed = true;

  const eligible = GetPlayer(game, player).hand.filter(c => splashCardIsAffordable(game, player, c.cardId));
  if (eligible.length === 0) {
    log.push(`Player ${player} used ${CardTitle(base.cardId)} — no affordable cards to play.`);
    return { response: stateResponse(game), pending: null, stateChanged: true };
  }

  log.push(`Player ${player} used ${CardTitle(base.cardId)}.`);
  const pending: PlayFromHandPending = { type: "play-from-hand", cardId: base.cardId, player };
  return { response: resolutionResponse(pendingToResolution(pending, game)), pending, stateChanged: false };
}

/** Can this card be played via a splash base — i.e. affordable as a unit OR as a Pilot, after the discount? */
function splashCardIsAffordable(game: GameState, player: PlayerId, cardId: string): boolean {
  const discount = splashAspectDiscount(game, player, cardId);
  const ready = spendableFor(game, player);

  const exploitAmt = ExploitAmount(cardId, "hand", player, true);
  const unitCost = Math.max(0, playCost(game, player, cardId) - discount);
  const minUnitCost = exploitAmt > 0 ? Math.max(0, unitCost - exploitAmt * 2) : unitCost;
  if (ready >= minUnitCost) return true;

  // A Pilot the player can't hard-cast may still be affordable attached to a Vehicle.
  if (PilotingCost(cardId) >= 0 && PilotingEligibleVehicles(game, player, cardId).length > 0) {
    const pilotCost = Math.max(0, pilotPlayCost(game, player, cardId) - discount);
    if (ready >= pilotCost) return true;
  }
  return false;
}

/**
 * LAW_019 Alliance Outpost — "Epic Action [defeat a friendly token]: Give an Experience or Shield
 * token to a unit, or create a Credit token."
 * Step 1 is the COST: pick a friendly token to defeat. A "token" is either a token unit
 * (Battle Droid, X-Wing, Spy…) or a token upgrade (Experience, Shield, Advantage).
 */
function friendlyTokenPlayIds(game: GameState, player: PlayerId): string[] {
  const pState = GetPlayer(game, player);
  const units = [...pState.groundArena, ...pState.spaceArena] as Unit[];
  const tokenUnits = units.filter(u => Unit.FromInterface(u).IsTokenUnit()).map(u => u.playId);
  // A token upgrade the player controls, wherever it is attached.
  const tokenUpgrades = GetAllUnits(game)
    .flatMap(u => u.upgrades)
    .filter(upg => IsTokenUpgrade(upg.cardId) && upg.controller === player)
    .map(upg => upg.playId);
  return [...tokenUnits, ...tokenUpgrades];
}

function resolveAllianceOutpostEpicAction(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const tokens = friendlyTokenPlayIds(game, player);
  if (tokens.length === 0) {
    return { response: invalidResponse("Alliance Outpost: you control no token to defeat."), pending: null, stateChanged: false };
  }

  GetPlayer(game, player).base.epicActionUsed = true;
  log.push(`Player ${player} used ${CardTitle("LAW_019")}.`);
  const pending: AbilityTargetPending = {
    type: "ability-target",
    cardId: "LAW_019_cost",
    player,
    fromPlayIds: tokens,
    continuation: null,
  };
  return { response: resolutionResponse(pendingToResolution(pending, game)), pending, stateChanged: false };
}

/** SOR_025 Tarkintown — "Epic Action: Deal 3 damage to a damaged non-leader unit." */
function resolveTarkintownEpicAction(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const eligible = GetAllUnits(game).filter(u => u.damage > 0 && !CardIsLeader(u.cardId));
  if (eligible.length === 0) {
    log.push(`${CardTitle("SOR_025")}: no damaged non-leader unit — soft pass.`);
    return { response: invalidResponse("Tarkintown: no damaged non-leader unit to damage."), pending: null, stateChanged: false };
  }

  GetPlayer(game, player).base.epicActionUsed = true;
  log.push(`Player ${player} used ${CardTitle("SOR_025")}.`);
  const pending: AbilityTargetPending = {
    type: "ability-target",
    cardId: "SOR_025",
    player,
    fromPlayIds: eligible.map(u => u.playId),
    continuation: null,
  };
  return { response: resolutionResponse(pendingToResolution(pending, game)), pending, stateChanged: false };
}

/** SOR_028 Jedha City — "Epic Action: Give a non-leader unit -4/-0 for this phase." */
function resolveJedhaCityEpicAction(game: GameState, log: string[], player: PlayerId): HandlerResult {
  const eligible = GetAllUnits(game).filter(u => !CardIsLeader(u.cardId));
  if (eligible.length === 0) {
    log.push(`${CardTitle("SOR_028")}: no non-leader unit — soft pass.`);
    return { response: invalidResponse("Jedha City: no non-leader unit to target."), pending: null, stateChanged: false };
  }

  GetPlayer(game, player).base.epicActionUsed = true;
  log.push(`Player ${player} used ${CardTitle("SOR_028")}.`);
  const pending: AbilityTargetPending = {
    type: "ability-target",
    cardId: "SOR_028",
    player,
    fromPlayIds: eligible.map(u => u.playId),
    continuation: null,
  };
  return { response: resolutionResponse(pendingToResolution(pending, game)), pending, stateChanged: false };
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

    // Grand Inquisitor (LOF_014) leader Action / On Attack: the defender gets -2/-0 for this attack.
    if (pending.source === "LOF_014" && target.type === "unit") {
      const def014 = GetUnitByPlayId(game, target.playId);
      if (def014) {
        GivePowerMod("LOF_014", def014, -2, "ForAttack", log);
        log.push(`${CardTitle("LOF_014")}: defender gets -2/-0 for this attack.`);
      }
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
    if (attacker && onAttackTriggerIndex !== -1) {
      // On Attack abilities that act on the defender before combat and need engine-level defeat
      // handling (upgrade defeat, lethal damage). They take no player input, so they resolve here.
      applyAutoOnAttackEffects(game, log, attacker, target);
    }
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
    // Leaders are not units, so a leader target arrives as a zone + player rather than a
    // playId. Normalize it to the "playerN.leader" form the eligible list uses, then let it
    // flow through the normal target path.
    const chosenLeader = data.targetZones?.includes("Leader")
      ? `player${data.targetPlayers?.[0] ?? pending.player ?? 1}.leader`
      : undefined;
    const chosen = data.targetPlayIds?.[0] ?? chosenLeader;
    const chosenBase = data.targetZones?.includes("Base") ?? false;

    // JTL_018 Kazuda Xiono On Attack: "Choose ANY NUMBER of friendly units." Zero is a legal
    // choice, so this must run before the empty-selection guard below.
    if (pending.cardId === "JTL_018_OA") {
      const chosen018 = data.targetPlayIds ?? [];
      for (const id of chosen018) {
        if (!pending.fromPlayIds.includes(id))
          return { response: invalidResponse(`Unit ${id} is not a valid target for ${CardTitle("JTL_018")}.`), pending, stateChanged: false };
      }
      for (const id of chosen018) {
        silenceUnitForRound(game, log, id);
      }
      const cont018 = pending.continuation;
      if (cont018?.type === "resolve-attack") return handleResolveAttack(game, log, cont018);
      if (cont018) return { response: resolutionResponse(pendingToResolution(cont018, game)), pending: cont018, stateChanged: true };
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    if (pending.cardId === "ASH_032") {
      // Rancor Keeper — deal 1 damage to each chosen base (any number, including zero).
      const chosenBases032 = data.targetPlayIds ?? [];
      for (const id of chosenBases032) {
        if (!pending.fromPlayIds.includes(id))
          return { response: invalidResponse(`${id} is not a valid target for ${CardTitle(pending.cardId)}.`), pending, stateChanged: false };
      }
      for (const id of chosenBases032) {
        const basePlayer032: PlayerId = id === "player1.base" ? 1 : 2;
        dealBaseDamage(game, basePlayer032, 1, pending.player);
        log.push(`${CardTitle("ASH_032")}: dealt 1 damage to Player ${basePlayer032}'s base.`);
      }
      updateDefeatedPlayers(game);
      const bagAsh032 = drainTriggerBag(game, log);
      if (bagAsh032) return { response: resolutionResponse(pendingToResolution(bagAsh032, game)), pending: bagAsh032, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    if (pending.cardId === "JTL_170" || pending.cardId === "JTL_140" || pending.cardId === "ASH_142") {
      // War Juggernaut — deal 1 to each chosen unit (any number).
      // IG-2000 — deal 1 to each chosen unit (up to 3).
      // Mortar Trooper — deal 1 to each of up to 3 chosen ground units.
      const cap = pending.cardId === "JTL_170" ? Infinity : 3;
      const chosenDmg = (data.targetPlayIds ?? []).slice(0, cap);
      for (const id of chosenDmg) {
        if (!pending.fromPlayIds.includes(id))
          return { response: invalidResponse(`Unit ${id} is not a valid target for ${CardTitle(pending.cardId)}.`), pending, stateChanged: false };
      }
      for (const id of chosenDmg) {
        DealDamageToUnit(game, pending.cardId, id, 1, log);
      }
      const nextDmg = sweepDeadUnits(game, log, pending.continuation ?? null);
      if (nextDmg?.type === "resolve-attack") return handleResolveAttack(game, log, nextDmg);
      if (nextDmg) return { response: resolutionResponse(pendingToResolution(nextDmg, game)), pending: nextDmg, stateChanged: true };
      updateDefeatedPlayers(game);
      const bagDmg = drainTriggerBag(game, log);
      if (bagDmg) return { response: resolutionResponse(pendingToResolution(bagDmg, game)), pending: bagDmg, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

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

    const rawPending = applyAbilityEffect(pending, chosenBase, chosen, data.targetPlayers?.[0]);
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

    if (pending.cardId === "SHD_015") {
      // Doctor Aphra When Deployed: the player chose 3 discard cards with different names; return 1
      // of them at random to hand (the other 2 stay in the discard).
      const pState015 = GetPlayer(game, pending.player);
      const picked015 = chosen.slice(0, 3)
        .map(id => pState015.discard.find(d => d.playId === id))
        .filter((d): d is NonNullable<typeof d> => !!d);
      const names015 = new Set(picked015.map(d => d.cardId));
      if (picked015.length < 3 || names015.size < 3) {
        return { response: invalidResponse("Choose 3 cards with different names."), pending, stateChanged: false };
      }
      const chosenAtRandom = picked015[Math.floor(Math.random() * picked015.length)];
      const idx015 = pState015.discard.findIndex(d => d.playId === chosenAtRandom.playId);
      if (idx015 !== -1) {
        const card015 = pState015.discard.splice(idx015, 1)[0];
        pState015.hand.push({ cardId: card015.cardId });
        log.push(`${CardTitle("SHD_015")}: returned ${CardTitle(card015.cardId)} to hand at random.`);
      }
      const next015 = pending.continuation;
      if (next015) return { response: resolutionResponse(pendingToResolution(next015, game)), pending: next015, stateChanged: false };
      const bag015 = drainTriggerBag(game, log);
      if (bag015) return { response: resolutionResponse(pendingToResolution(bag015, game)), pending: bag015, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    if (pending.cardId === "LAW_174") {
      // 0-0-0: move the chosen Aggression card to the bottom of the deck, then deal 1 to each enemy base.
      const player174 = pending.player;
      const pState174 = GetPlayer(game, player174);
      const playId174 = chosen[0];
      const idx174 = pState174.discard.findIndex(d => d.playId === playId174);
      if (idx174 !== -1) {
        const card174 = pState174.discard.splice(idx174, 1)[0];
        pState174.deck.unshift({ cardId: card174.cardId }); // bottom of deck (top is popped from the end)
        const enemyPlayer174: PlayerId = player174 === 1 ? 2 : 1;
        const enemyState174 = GetPlayer(game, enemyPlayer174);
        enemyState174.base.damage += CapBaseDamage(enemyPlayer174, 1);
        log.push(`${CardTitle("LAW_174")}: put ${CardTitle(card174.cardId)} on the bottom of the deck and dealt 1 damage to the enemy base.`);
      }
      const next174 = pending.continuation;
      if (next174?.type === "resolve-attack") return handleResolveAttack(game, log, next174);
      if (next174) return { response: resolutionResponse(pendingToResolution(next174, game)), pending: next174, stateChanged: false };
      const bag174 = drainTriggerBag(game, log);
      if (bag174) return { response: resolutionResponse(pendingToResolution(bag174, game)), pending: bag174, stateChanged: false };
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

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

    // TWI_189 Unnatural Life: play the chosen unit from discard at cost -2, entering ready, and
    // defeat it at the start of the regroup phase (via the UntilStartOfRegroup effect).
    if (pending.cardId === "TWI_189") {
      const playId189 = chosen[0];
      if (!playId189) {
        const bag189a = drainTriggerBag(game, log);
        if (bag189a) return { response: resolutionResponse(pendingToResolution(bag189a, game)), pending: bag189a, stateChanged: true };
        return { response: stateResponse(game), pending: null, stateChanged: true };
      }
      const playerState189 = GetPlayer(game, pending.player);
      const idx189 = playerState189.discard.findIndex(d => d.playId === playId189);
      if (idx189 === -1)
        return { response: invalidResponse("Unnatural Life: card not found in discard."), pending, stateChanged: false };
      const cardId189 = playerState189.discard[idx189].cardId;
      const reducedCost189 = Math.max(0, playCost(game, pending.player, cardId189) - 2);
      const ready189 = spendableFor(game, pending.player);
      if (ready189 < reducedCost189)
        return { response: invalidResponse(`Unnatural Life: not enough resources to play ${CardTitle(cardId189)} (needs ${reducedCost189}).`), pending, stateChanged: false };
      playerState189.discard.splice(idx189, 1);
      payResources(game, pending.player, reducedCost189, log, cardId189);
      log.push(`${CardTitle("TWI_189")}: played ${CardTitle(cardId189)} from discard (cost -2 = ${reducedCost189}, enters ready).`);
      return completePlayCard(game, log, cardId189, pending.player, {
        enterReady: true,
        injectEffect: { cardId: "TWI_189", duration: "UntilStartOfRegroup", affectedPlayer: pending.player },
      });
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

  if (pending.type === "hand-to-deck") {
    const idx = data.targetIndices?.[0];
    if (idx == null)
      return { response: invalidResponse("Choose a card from your hand."), pending, stateChanged: false };
    const hand = GetPlayer(game, pending.player).hand;
    if (idx < 0 || idx >= hand.length)
      return { response: invalidResponse("Invalid hand index."), pending, stateChanged: false };
    const [held] = hand.splice(idx, 1);
    // The card is out of hand; now ask where it goes.
    const placement: ChooseOnePending = {
      type: "choose-one",
      cardId: pending.cardId,
      player: pending.player,
      options: [
        { id: "top", label: `Put ${CardTitle(held.cardId)} on top of your deck` },
        { id: "bottom", label: `Put ${CardTitle(held.cardId)} on the bottom of your deck` },
      ],
      data: { heldCardId: held.cardId },
      continuation: pending.continuation,
    };
    return { response: resolutionResponse(pendingToResolution(placement, game)), pending: placement, stateChanged: false };
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
    // JTL_014 Admiral Trench: only cards costing minCost or more are eligible to discard.
    if (pending.minCost !== undefined && (CardCost(playerHand[idx].cardId) ?? 0) < pending.minCost)
      return { response: invalidResponse(`Chosen card must cost ${pending.minCost} or more.`), pending, stateChanged: false };
    const [discardedCard] = playerHand.splice(idx, 1);
    const discardedCost = CardCost(discardedCard.cardId) ?? 0;
    GetPlayer(game, pending.targetPlayer).discard.push({
      cardId: discardedCard.cardId, playId: String(game.nextPlayId++),
      owner: pending.targetPlayer, controller: pending.targetPlayer,
      turnDiscarded: game.currentRound, discardEffect: "",
    });
    log.push(`Player ${pending.targetPlayer} discarded a card.`);
    // JTL_014 Admiral Trench: "If you do, draw a card."
    if (pending.thenDrawForPlayer !== undefined) DrawCardForPlayer(game, log, pending.thenDrawForPlayer);
    const remaining = pending.count - 1;
    let nextPending: PendingResolution | null = remaining > 0
      ? { type: "discard-from-hand", targetPlayer: pending.targetPlayer, count: remaining, continuation: pending.continuation }
      : (pending.continuation ?? null);

    // ASH_172 Razor Crest: "If you do, this unit gets +2/+0 for this attack."
    if (remaining === 0 && pending.thenAttackBuff) {
      const buffTarget172 = GetUnitByPlayId(game, pending.thenAttackBuff.playId);
      if (buffTarget172) {
        GivePowerMod(pending.thenAttackBuff.cardId, buffTarget172, pending.thenAttackBuff.amount, "ForAttack", log);
      }
    }

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
    if (nextPending?.type === "resolve-attack") {
      return handleResolveAttack(game, log, nextPending);
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

    // JTL_101 Red Leader: When a Pilot upgrade attaches to this unit — create an X-Wing token.
    if (IsPilotUpgrade(pending.upgradeCardId) && targetUnit.cardId === "JTL_101") {
      CreateXWing(game, pending.player, log, "JTL_101");
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

    // LOF_091 Craving Power: When Played — deal damage to an enemy unit equal to attached unit's
    // power. The upgrade is already attached, so its own +2 power is included.
    if (pending.upgradeCardId === "LOF_091") {
      const enemy091: PlayerId = pending.player === 1 ? 2 : 1;
      const enemyUnits091 = GetUnitsForPlayer(enemy091);
      if (enemyUnits091.length > 0) {
        const cravingPowerPending: AbilityTargetPending = {
          type: "ability-target",
          cardId: "LOF_091",
          player: pending.player,
          fromPlayIds: enemyUnits091.map(u => u.playId),
          amount: Unit.FromInterface(targetUnit).CurrentPower(),
          continuation: null,
        };
        updateDefeatedPlayers(game);
        return { response: resolutionResponse(pendingToResolution(cravingPowerPending, game)), pending: cravingPowerPending, stateChanged: true };
      }
    }

    // Snapshot Reflexes: When Played — may attack with attached unit if it's ready.
    if (pending.upgradeCardId === "SOR_215" || pending.upgradeCardId === "SHD_223") {
      if (targetUnit.ready && CanUnitAttack(targetUnit)) {
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
      case "LOF_016_play": { // Qui-Gon Jinn — play a non-Villainy unit costing less than the returned
                             // unit, for free.
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Qui-Gon Jinn: chosen card is not a Unit."), pending, stateChanged: false };
        if (pending.excludeAspect && CardAspects(cardId).includes(pending.excludeAspect))
          return { response: invalidResponse("Qui-Gon Jinn: chosen unit is Villainy."), pending, stateChanged: false };
        if (pending.maxCost !== undefined && (CardCost(cardId) ?? 0) > pending.maxCost)
          return { response: invalidResponse("Qui-Gon Jinn: chosen unit costs too much."), pending, stateChanged: false };
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId)} for free via Qui-Gon Jinn.`);
        const res016 = completePlayCard(game, log, cardId, pending.player);
        if (pending.continuation && res016.pending) {
          const chained016 = injectContinuation(res016.pending, pending.continuation);
          return { response: resolutionResponse(pendingToResolution(chained016, game)), pending: chained016, stateChanged: true };
        }
        if (pending.continuation && !res016.pending) {
          return { response: resolutionResponse(pendingToResolution(pending.continuation, game)), pending: pending.continuation, stateChanged: true };
        }
        return res016;
      }
      case "LOF_005": { // Morgan Elsbeth — play a hand unit that shares a keyword with the chosen
                        // attacked unit, for 1 resource less.
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Morgan Elsbeth: chosen card is not a Unit."), pending, stateChanged: false };
        const shares005 = SharesKeyword(cardId, pending.sharesKeywordWithCardId ?? "", {},
          { player: pending.sharesKeywordWithPlayer, playId: pending.sharesKeywordWithPlayId });
        if (!shares005)
          return { response: invalidResponse("Morgan Elsbeth: chosen unit shares no keyword with the attacker."), pending, stateChanged: false };
        const cost005m = Math.max(0, playCost(game, pending.player, cardId) - (pending.costReduction ?? 0));
        if (spendableFor(game, pending.player) < cost005m)
          return { response: invalidResponse("Not enough resources to play this unit."), pending, stateChanged: false };
        payResources(game, pending.player, cost005m, log, cardId);
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId)} via Morgan Elsbeth (-1 cost).`);
        return completePlayCard(game, log, cardId, pending.player);
      }
      case "JTL_005": { // Admiral Piett — play a Capital Ship unit from hand at -1 cost.
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Admiral Piett: chosen card is not a Unit."), pending, stateChanged: false };
        if (!CardTraits(cardId).includes("Capital Ship"))
          return { response: invalidResponse("Admiral Piett: chosen unit is not a Capital Ship."), pending, stateChanged: false };
        const cost005 = Math.max(0, playCost(game, pending.player, cardId) - 1);
        const ready005 = spendableFor(game, pending.player);
        if (ready005 < cost005)
          return { response: invalidResponse("Not enough resources to play this unit."), pending, stateChanged: false };
        payResources(game, pending.player, cost005, log, cardId);
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId)} via Admiral Piett (-1 cost).`);
        return completePlayCard(game, log, cardId, pending.player);
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
      case "LAW_020": case "LAW_021": case "LAW_022": case "LAW_024":
      case "LAW_025": case "LAW_027": case "LAW_028": case "LAW_030": {
        // Splash bases: any card in hand, played at -2 if it has an uncovered non-side aspect.
        // playCardFromHand carries the discount through Piloting, Exploit and Credit payment.
        const discount = splashAspectDiscount(game, pending.player, cardId);
        if (!splashCardIsAffordable(game, pending.player, cardId))
          return { response: invalidResponse(`Not enough resources to play ${CardTitle(cardId) ?? cardId}.`), pending, stateChanged: false };
        log.push(`Player ${pending.player} is playing ${CardTitle(cardId) ?? cardId} via ${CardTitle(pending.cardId)}${discount > 0 ? " (1 aspect penalty ignored)" : ""}.`);
        return playCardFromHand(game, log, pending.player, cardId, discount);
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
      case "LOF_220": { // Shien Flurry — play a FORCE unit from hand (paying its cost).
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Shien Flurry: chosen card is not a Unit."), pending, stateChanged: false };
        if (!CardTraits(cardId).includes("Force"))
          return { response: invalidResponse("Shien Flurry: chosen unit does not have the Force trait."), pending, stateChanged: false };
        const sfCost = playCost(game, pending.player, cardId);
        if (spendableFor(game, pending.player) < sfCost)
          return { response: invalidResponse("Shien Flurry: not enough resources to play this unit."), pending, stateChanged: false };
        payResources(game, pending.player, sfCost, log, cardId);
        hand.splice(idx, 1);
        log.push(`Player ${pending.player} played ${CardTitle(cardId) ?? cardId} via Shien Flurry.`);
        // injectEffect LOF_220 grants Ambush this phase (read in ambush.ts) and, via
        // queueUnitEntryTriggers, spawns the sibling LOF_220_prevent one-shot prevention.
        return completePlayCard(game, log, cardId, pending.player, {
          injectEffect: { cardId: "LOF_220", duration: "Phase", affectedPlayer: pending.player },
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
      case "SEC_004": { // Leia Organa disclose: the revealed card must carry one of the five aspects.
        if (!CardsCanDisclose([cardId], []) || !CardAspects(cardId).some(a => SEC_004_ASPECTS.includes(a))) {
          return { response: invalidResponse("Disclose: revealed card has none of Vigilance, Command, Aggression, Cunning or Heroism."), pending, stateChanged: false };
        }
        log.push(`${CardTitle("SEC_004")}: disclosed ${CardTitle(cardId)}.`);
        // "a unit that doesn't share an aspect with the disclosed card"
        const eligible004 = UnitsNotSharingAspectWith(cardId);
        if (eligible004.length === 0) {
          log.push(`${CardTitle("SEC_004")}: no unit without a shared aspect — no token given.`);
          const bag004 = drainTriggerBag(game, log);
          if (bag004) return { response: resolutionResponse(pendingToResolution(bag004, game)), pending: bag004, stateChanged: true };
          return { response: stateResponse(game), pending: null, stateChanged: true };
        }
        const xpPending: AbilityTargetPending = {
          type: "ability-target",
          cardId: "SEC_004_xp",
          player: pending.player,
          fromPlayIds: eligible004.map(u => u.playId),
          continuation: null,
        };
        return { response: resolutionResponse(pendingToResolution(xpPending, game)), pending: xpPending, stateChanged: false };
      }
      case "SEC_148": { // Karis Nemik disclose pick 1: needs Aggression + Heroism across the revealed cards
        const has148A = CardsCanDisclose([cardId], ["Aggression"]);
        const has148H = CardsCanDisclose([cardId], ["Heroism"]);
        if (!has148A && !has148H)
          return { response: invalidResponse("Disclose: revealed card has neither an Aggression nor a Heroism aspect."), pending, stateChanged: false };
        log.push(`${CardTitle("SEC_148")}: disclosed ${CardTitle(cardId)}.`);
        if (has148A && has148H) {
          // One card covered both icons — the disclose is complete.
          createReadySpy(game, pending.player, log);
          const bag148 = drainTriggerBag(game, log);
          if (bag148) return { response: resolutionResponse(pendingToResolution(bag148, game)), pending: bag148, stateChanged: true };
          return { response: stateResponse(game), pending: null, stateChanged: true };
        }
        // Only one icon so far — reveal a second, different card carrying the other one.
        const needs148: PlayFromHandPending = {
          type: "play-from-hand",
          cardId: has148A ? "SEC_148_H" : "SEC_148_A",
          player: pending.player,
          excludeHandIndex: idx,
        };
        return { response: resolutionResponse(pendingToResolution(needs148, game)), pending: needs148, stateChanged: false };
      }
      case "SEC_148_A": // Karis Nemik disclose pick 2: the still-missing icon
      case "SEC_148_H": {
        const needed148 = pending.cardId === "SEC_148_A" ? "Aggression" : "Heroism";
        if (idx === pending.excludeHandIndex)
          return { response: invalidResponse("Disclose: the icons must come from different cards."), pending, stateChanged: false };
        if (!CardsCanDisclose([cardId], [needed148]))
          return { response: invalidResponse(`Disclose: revealed card does not have a ${needed148} aspect.`), pending, stateChanged: false };
        log.push(`${CardTitle("SEC_148")}: disclosed ${CardTitle(cardId)} (${needed148}) — requirement met.`);
        createReadySpy(game, pending.player, log);
        const bag148b = drainTriggerBag(game, log);
        if (bag148b) return { response: resolutionResponse(pendingToResolution(bag148b, game)), pending: bag148b, stateChanged: true };
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
      case "ASH_132": { // Queen Soruna — revealed a unit; deal 3 damage to a unit with the same cost.
        if (CardType(cardId) !== "Unit")
          return { response: invalidResponse("Queen Soruna: chosen card is not a Unit."), pending, stateChanged: false };
        log.push(`${CardTitle("ASH_132")}: revealed ${CardTitle(cardId) ?? cardId}.`);
        const revealedCost132 = CardCost(cardId) ?? 0;
        const matching132 = [
          ...game.player1.groundArena, ...game.player1.spaceArena,
          ...game.player2.groundArena, ...game.player2.spaceArena,
        ].filter(u => (CardCost(u.cardId) ?? 0) === revealedCost132);
        if (matching132.length === 0) {
          const next132 = pending.continuation ?? null;
          if (next132?.type === "resolve-attack") return handleResolveAttack(game, log, next132);
          return next132
            ? { response: resolutionResponse(pendingToResolution(next132, game)), pending: next132, stateChanged: true }
            : { response: stateResponse(game), pending: null, stateChanged: true };
        }
        const queenPending: AbilityTargetPending = {
          type: "ability-target",
          cardId: "ASH_132",
          player: pending.player,
          fromPlayIds: matching132.map(u => u.playId),
          continuation: pending.continuation ?? null,
        };
        return { response: resolutionResponse(pendingToResolution(queenPending, game)), pending: queenPending, stateChanged: false };
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
        GetPlayer(game, pending.player).base.damage += CapBaseDamage(pending.player, baseCost235);
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

  if (pending.type === "spread-tokens") {
    const assignments = (data.spreadDamageAssignments ?? []).filter(
      a => pending.eligiblePlayIds.includes(a.playId) && a.damage > 0,
    );
    const total = assignments.reduce((sum, a) => sum + a.damage, 0);
    if (pending.optional) {
      if (total !== 0 && total !== pending.totalTokens) {
        return { response: invalidResponse(`Distribute 0 or all ${pending.totalTokens} tokens. No partial distribution.`), pending, stateChanged: false };
      }
    } else if (total !== pending.totalTokens) {
      return { response: invalidResponse(`Must distribute exactly ${pending.totalTokens} tokens.`), pending, stateChanged: false };
    }

    for (const assignment of assignments) {
      const unit = GetUnitByPlayId(game, assignment.playId);
      if (!unit) continue;
      GiveAdvantageTokens(game, unit, assignment.damage, log, pending.cardId);
    }

    updateDefeatedPlayers(game);
    const nextTokens = pending.continuation ?? null;
    if (nextTokens) return { response: resolutionResponse(pendingToResolution(nextTokens, game)), pending: nextTokens, stateChanged: true };
    const bagTokens = drainTriggerBag(game, log);
    if (bagTokens) return { response: resolutionResponse(pendingToResolution(bagTokens, game)), pending: bagTokens, stateChanged: true };
    return { response: stateResponse(game), pending: null, stateChanged: true };
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
        if (assignment.damage > 0) MarkUnitDamaged(game, unit.playId);
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
      if (unit) {
        unit.damage += a.damage;
        if (a.damage > 0) MarkUnitDamaged(game, unit.playId);
      }
    }

    // Apply base damage
    const targetState = pending.targetPlayer === 1 ? game.player1 : game.player2;
    if (baseDamage > 0) {
      targetState.base.damage += CapBaseDamage(pending.targetPlayer, baseDamage);
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

  if (pending.type === "trench-reveal") {
    if (dispatch.fromPlayer !== pending.chooser)
      return { response: invalidResponse("It is not your choice to make."), pending, stateChanged: false };
    const chosen = data.targetPlayIds ?? [];
    const cardMap = new Map(pending.revealed.map(c => [c.tempId, c]));
    for (const id of chosen)
      if (!cardMap.has(id))
        return { response: invalidResponse(`Trench: unknown selection "${id}".`), pending, stateChanged: false };
    const owner = GetPlayer(game, pending.player);
    const toDiscard = (cards: Array<{ tempId: string; cardId: string }>) => {
      for (const c of cards)
        owner.discard.push({ cardId: c.cardId, playId: String(game.nextPlayId++), owner: pending.player, controller: pending.player, turnDiscarded: game.currentRound, discardEffect: "" });
    };

    if (pending.stage === "opponent-discard") {
      const need = Math.min(2, pending.revealed.length);
      if (chosen.length !== need)
        return { response: invalidResponse(`Trench: choose exactly ${need} card(s) to discard.`), pending, stateChanged: false };
      const discardSet = new Set(chosen);
      const discarded = pending.revealed.filter(c => discardSet.has(c.tempId));
      const remaining = pending.revealed.filter(c => !discardSet.has(c.tempId));
      toDiscard(discarded);
      log.push(`${CardTitle(pending.cardId)}: opponent discarded ${discarded.length} of the revealed cards.`);
      if (remaining.length === 0) {
        const cont = pending.continuation ?? null;
        if (cont) return { response: resolutionResponse(pendingToResolution(cont, game)), pending: cont, stateChanged: true };
        return { response: stateResponse(game), pending: null, stateChanged: true };
      }
      // Trench's controller now draws 1 of the remaining and discards the other.
      const drawStep: TrenchRevealPending = {
        type: "trench-reveal",
        cardId: pending.cardId,
        player: pending.player,
        chooser: pending.player,
        stage: "self-draw",
        revealed: remaining,
        continuation: pending.continuation,
      };
      return { response: resolutionResponse(pendingToResolution(drawStep, game)), pending: drawStep, stateChanged: true };
    }

    // stage === "self-draw": draw exactly 1 of the remaining; discard the rest.
    if (chosen.length !== 1)
      return { response: invalidResponse("Trench: choose exactly 1 card to draw."), pending, stateChanged: false };
    const drawn = cardMap.get(chosen[0])!;
    owner.hand.push({ cardId: drawn.cardId });
    toDiscard(pending.revealed.filter(c => c.tempId !== chosen[0]));
    log.push(`${CardTitle(pending.cardId)}: drew ${CardTitle(drawn.cardId)} and discarded the other revealed card.`);
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

/**
 * Rescue a captured card (CR 34.4): remove it from whichever unit is guarding it and return it to
 * its owner's arena exhausted. Rescued units do NOT regain Hidden protection (reason
 * "returned-to-play"). Shared entry point for cards that rescue on demand (L3-37 SHD_197).
 */
function rescueCaptiveByPlayId(game: GameState, log: string[], captivePlayId: string, fromCardId: string): boolean {
  for (const pState of [game.player1, game.player2]) {
    for (const u of [...pState.groundArena, ...pState.spaceArena]) {
      const idx = (u.captives ?? []).findIndex(c => c.playId === captivePlayId);
      if (idx === -1) continue;
      const [captive] = u.captives.splice(idx, 1);
      const arena = (CardArena(captive.cardId) ?? "Ground") as "Ground" | "Space";
      const rescued = Unit.FromInterface({ ...captive, ready: false });
      if (arena === "Ground") GetPlayer(game, captive.owner).groundArena.push(rescued);
      else GetPlayer(game, captive.owner).spaceArena.push(rescued);
      game.roundState.cardsEnteredPlayThisPhase.push({
        fromPlayer: captive.owner, cardId: captive.cardId, playId: captive.playId, reason: "returned-to-play",
      });
      log.push(`${CardTitle(fromCardId)}: rescued ${CardTitle(captive.cardId)} — returned to Player ${captive.owner}'s arena exhausted.`);
      return true;
    }
  }
  return false;
}

/** Give a Shield token (SOR_T02) to the unit identified by playId. */
function giveShieldToUnit(game: GameState, playId: string): Unit | null {
  const unit = GetUnitByPlayId(game, playId);
  if (unit) {
    unit.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game), owner: unit.owner, controller: unit.controller });
  }
  return unit ?? null;
}

function applyAbilityOptionEffect(
  pending: AbilityOptionPending,
  game: GameState,
  log: string[],
): PendingResolution | null {
  switch (pending.cardId) {
    case "SHD_197": { // L3-37 Yes: rescue a captured card. One captive → rescue it; many → let the player pick.
      const captives197 = AllCaptives();
      if (captives197.length === 0) return pending.continuation ?? null; // nothing to rescue (shouldn't happen)
      if (captives197.length === 1) {
        rescueCaptiveByPlayId(game, log, captives197[0].playId, "SHD_197");
        return pending.continuation ?? null;
      }
      return {
        type: "choose-one",
        cardId: "SHD_197",
        player: pending.player!,
        options: captives197.map(c => ({ id: c.playId, label: CardTitle(c.cardId) ?? c.cardId })),
        continuation: pending.continuation ?? null,
      } satisfies ChooseOnePending;
    }
    case "JTL_197": { // Anakin (pilot) Yes — return this upgrade to its owner's hand.
      const upgradePlayId = pending.sourcePlayId;
      if (!upgradePlayId) return pending.continuation ?? null;
      for (const unit of GetAllUnits(game)) {
        const idx = unit.upgrades.findIndex(u => u.playId === upgradePlayId);
        if (idx === -1) continue;
        const [returned] = unit.upgrades.splice(idx, 1);
        GetPlayer(game, returned.owner).hand.push({ cardId: returned.cardId });
        log.push(`${CardTitle(returned.cardId)} was returned to its owner's hand.`);
        break;
      }
      return pending.continuation ?? null;
    }
    case "TWI_016": { // Jango Fett — (front: exhaust this leader,) then exhaust that enemy unit.
      const leader016 = GetLeaderForPlayer(pending.player!);
      if (!leader016.deployed) leader016.ready = false; // front side: exhausting the leader is the cost
      const enemy016 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (enemy016) {
        enemy016.ready = false;
        log.push(`${CardTitle("TWI_016")}: exhausted ${CardTitle(enemy016.cardId)}.`);
      }
      return pending.continuation ?? null;
    }
    case "SOR_015": { // Boba Fett — exhaust this leader (front side), then ready a resource.
      const leader015 = GetLeaderForPlayer(pending.player!);
      if (!leader015.deployed) leader015.ready = false; // front side: exhausting the leader is the cost
      const res015 = GetPlayer(game, pending.player!).resources.find(r => !r.ready);
      if (res015) {
        res015.ready = true;
        log.push(`${CardTitle("SOR_015")}: exhausted Boba Fett to ready a resource.`);
      }
      return pending.continuation ?? null;
    }
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
    case "LOF_031": // Karis When Defeated — Use the Force, then give a unit –2/–2 for this phase.
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
    case "ASH_014": { // The Mandalorian (deployed) Yes — draw a card (you have the initiative).
      const mando014 = GetUnitByPlayId(game, pending.sourcePlayId!);
      const player014 = mando014 ? mando014.controller : pending.player!;
      DrawCardForPlayer(game, log, player014);
      log.push(`${CardTitle("ASH_014")}: drew a card.`);
      return pending.continuation ?? null;
    }
    case "LAW_048": { // Chio Fain On Attack Yes — both players each draw a card.
      DrawCardForPlayer(game, log, 1);
      DrawCardForPlayer(game, log, 2);
      log.push(`${CardTitle("LAW_048")}: both players drew a card.`);
      return pending.continuation ?? null;
    }
    case "ASH_014_initiative": { // The Mandalorian (leader side) Yes — pay 1 resource, draw a card.
      const player014i = pending.player!;
      payResources(game, player014i, 1, log, "ASH_014");
      DrawCardForPlayer(game, log, player014i);
      log.push(`${CardTitle("ASH_014")}: paid 1 resource and drew a card.`);
      return pending.continuation ?? null;
    }
    case "ASH_059": { // Leia Organa Yes — deal 1 damage to herself; if you do, heal 2 from your base.
      const leia059 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (!leia059) return pending.continuation ?? null;
      DealDamageToUnit(game, "ASH_059", leia059.playId, 1, log);
      HealBaseForPlayer(game, leia059.controller, 2, log, "ASH_059");
      return sweepDeadUnits(game, log, pending.continuation ?? null);
    }
    case "ASH_203": { // Mando's N-1 Starfighter Yes — exhaust your leader for +2/+0 for this attack.
      const n1_203 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (!n1_203) return pending.continuation ?? null;
      const leader203 = GetLeaderForPlayer(n1_203.controller);
      if (!leader203.ready) return pending.continuation ?? null; // readied state changed under us
      leader203.ready = false;
      log.push(`${CardTitle("ASH_203")}: exhausted ${CardTitle(leader203.cardId)}.`);
      GivePowerMod("ASH_203", n1_203, 2, "ForAttack", log);
      return pending.continuation ?? null;
    }
    case "LOF_260": { // The Father Yes — deal 1 damage to himself; if you do, the Force is with you.
      const father260 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (!father260) return pending.continuation ?? null;
      const player260 = father260.controller;
      DealDamageToUnit(game, "LOF_260", father260.playId, 1, log);
      CreateForceToken(player260, log, "LOF_260");
      return sweepDeadUnits(game, log, pending.continuation ?? null);
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
    case "LAW_159": { // Expendable Mercenary — resource it from its OWNER's discard into the
                      // controller's resource zone (stolen if they aren't the owner).
      const controller159 = pending.player!;
      const owner159 = (pending.amount ?? controller159) as PlayerId;
      const ownerDiscard = GetPlayer(game, owner159).discard;
      const idx159 = ownerDiscard.findIndex(d => d.playId === pending.sourcePlayId);
      if (idx159 === -1) return pending.continuation ?? null; // already gone — nothing to resource
      const [card159] = ownerDiscard.splice(idx159, 1);
      GetPlayer(game, controller159).resources.push({
        cardId: card159.cardId,
        playId: nextPlayId(game),
        owner: owner159,
        controller: controller159,
        ready: true,
        stolen: owner159 !== controller159,
      });
      log.push(`${CardTitle("LAW_159")}: resourced from Player ${owner159}'s discard by Player ${controller159}.`);
      return pending.continuation ?? null;
    }
    case "SOR_016": // Yes = reveal own deck
      return thrawnsReveal(game, log, pending.player!, pending.player!);
    case "TS26_077": { // Deployed Droideka Yes: pay 2 resources, give this unit an XP + Shield token.
      const unit077 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (unit077) {
        payResources(game, unit077.controller, 2, log, "TS26_077");
        unit077.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game), owner: unit077.owner, controller: unit077.controller });
        unit077.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game), owner: unit077.owner, controller: unit077.controller });
        log.push(`${CardTitle("TS26_077")}: paid 2 resources — gained an Experience token and a Shield token.`);
      }
      return pending.continuation ?? null;
    }
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
        MarkUnitDamaged(game, u.playId);
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
    case "JTL_186": { // Mist Hunter Yes: draw a card.
      DrawCardForPlayer(game, log, pending.player!);
      log.push(`${CardTitle("JTL_186")}: drew a card.`);
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
    case "LOF_012_wd": { // Rey When Deployed Yes: discard your whole hand, then draw 2 cards.
      const player012 = pending.player!;
      const pState012 = GetPlayer(game, player012);
      const discarded012 = pState012.hand.length;
      for (const c of pState012.hand.splice(0)) {
        pState012.discard.push({ cardId: c.cardId, playId: String(game.nextPlayId++), owner: player012, controller: player012, turnDiscarded: game.currentRound, discardEffect: "" });
      }
      DrawCardForPlayer(game, log, player012);
      DrawCardForPlayer(game, log, player012);
      log.push(`${CardTitle("LOF_012")}: discarded ${discarded012} card(s) and drew 2.`);
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
    case "SHD_197": { // L3-37 No: "If you don't [rescue], give a Shield token to this unit."
      const l337 = giveShieldToUnit(game, pending.sourcePlayId!);
      if (l337) log.push(`${CardTitle("SHD_197")}: gave a Shield token to ${CardTitle(l337.cardId)}.`);
      return pending.continuation ?? null;
    }
    case "SEC_193": { // Thrawn — the opponent gave up no unit, so "ready this unit."
      const thrawn193 = GetUnitByPlayId(game, pending.sourcePlayId!);
      if (thrawn193) {
        thrawn193.ready = true;
        log.push(`${CardTitle("SEC_193")}: no unit was given up — readied ${CardTitle(thrawn193.cardId)}.`);
      }
      return pending.continuation ?? null;
    }
    case "SOR_119": { // Reinforcement Walker No — discard top card and heal 3 from base
      const pState119No = GetPlayer(game, pending.player!);
      const top119No = pState119No.deck.pop();
      if (top119No) {
        pushEventToDiscard(game, pending.player!, top119No.cardId);
        log.push(`${CardTitle(pending.cardId)}: discarded ${CardTitle(top119No.cardId)}.`);
        if (!BaseHealingPrevented()) { // TWI_132 Confederate Tri-Fighter
          pState119No.base.damage = Math.max(0, pState119No.base.damage - 3);
          log.push(`${CardTitle(pending.cardId)}: healed 3 damage from player ${pending.player!}'s base.`);
        }
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
        MarkUnitDamaged(game, u.playId);
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

  if (pending?.type === "thrawn-replay") {
    if (option !== "Yes" && option !== "No") {
      return { response: invalidResponse(`Unknown option: ${option}`), pending, stateChanged: false };
    }
    if (option === "No") {
      const cont = pending.continuation;
      if (cont) return { response: resolutionResponse(pendingToResolution(cont, game)), pending: cont, stateChanged: false };
      const bagNo = drainTriggerBag(game, log);
      if (bagNo) return { response: resolutionResponse(pendingToResolution(bagNo, game)), pending: bagNo, stateChanged: false };
      updateDefeatedPlayers(game);
      return { response: stateResponse(game), pending: null, stateChanged: true };
    }

    // Pay the cost, then use the ability again.
    if (pending.deployed) {
      game.currentEffects.push({ cardId: "JTL_002_usedThisRound", duration: "Round", affectedPlayer: pending.player });
      log.push(`${CardTitle("JTL_002")}: using that When Defeated ability again (once this round).`);
    } else {
      GetPlayer(game, pending.player).leader.ready = false;
      log.push(`${CardTitle("JTL_002")}: exhausted to use that When Defeated ability again.`);
    }
    // Plain resolveWhenDefeated — a replay must not chain another Thrawn prompt.
    const replay = resolveWhenDefeated(Unit.FromInterface(pending.defeatedUnit), pending.player);
    const next = replay ? injectContinuation(replay, pending.continuation) : pending.continuation;
    if (next) return { response: resolutionResponse(pendingToResolution(next, game)), pending: next, stateChanged: false };
    const bagYes = drainTriggerBag(game, log);
    if (bagYes) return { response: resolutionResponse(pendingToResolution(bagYes, game)), pending: bagYes, stateChanged: false };
    updateDefeatedPlayers(game);
    return { response: stateResponse(game), pending: null, stateChanged: true };
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
      const eligibleVehicles = PilotingEligibleVehicles(game, pending.playingPlayer, pending.cardId);
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

  // ASH_014 The Mandalorian (leader side) — "When you take the initiative: You may pay 1 resource.
  // If you do, draw a card." A leader-side ability, so it stops once he deploys.
  const player = dispatch.fromPlayer;
  const leader014 = GetPlayer(game, player).leader;
  if (
    leader014.cardId === "ASH_014" && !leader014.deployed && !LeaderAbilitiesIgnored()
    && spendableFor(game, player) >= 1
  ) {
    const pending014: AbilityOptionPending = {
      type: "ability-option",
      cardId: "ASH_014_initiative",
      player,
      helperText: "Pay 1 resource to draw a card?",
      yesLabel: "Pay 1",
      noLabel: "Skip",
      onYes: null,
      continuation: null,
    };
    return { response: resolutionResponse(pendingToResolution(pending014, game)), pending: pending014, stateChanged: true };
  }

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
/**
 * JTL_018 Kazuda Xiono — "loses all abilities for this round." Unit.LostAbilities() already
 * recognizes a JTL_018 effect; this is the producing side. affectedPlayer must be the target
 * unit's controller, since LostAbilities reads the effects of the unit's own controller.
 */
function silenceUnitForRound(game: GameState, log: string[], targetPlayId: string): void {
  const target = GetUnitByPlayId(game, targetPlayId);
  if (!target) return;
  const alreadySilenced = game.currentEffects.some(
    e => e.cardId === "JTL_018" && e.targetPlayId === targetPlayId,
  );
  if (alreadySilenced) return;

  game.currentEffects.push({
    cardId: "JTL_018",
    duration: "Round",
    affectedPlayer: target.controller,
    targetPlayId,
  });
  log.push(`${CardTitle("JTL_018")}: ${CardTitle(target.cardId)} loses all abilities for this round.`);
}

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

  // "Take an extra action after this one" — the acting player keeps priority instead of the
  // turn passing. Consumed once.
  if (game.roundState.extraActionPlayer === game.activePlayer) {
    game.roundState.extraActionPlayer = undefined;
    log.push(`Player ${game.activePlayer} takes an extra action.`);
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
    case "TWI_004": return true; // Yoda — may discard from deck, then defeat a unit by cost
    case "TWI_007": return true; // Captain Rex — create a Clone Trooper token
    case "JTL_014": return true; // Admiral Trench — reveal 4, opponent discards 2, draw 1/discard 1
    case "LOF_012": return true; // Rey — may discard your hand to draw 2
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
    case "TWI_004": // Yoda — If you control 7 or more resources.
      return p.resources.length >= 7;
    case "JTL_002": // Grand Admiral Thrawn (JTL) — If you control 6 or more resources.
      return p.resources.length >= 6;
    case "ASH_004": // Grand Admiral Thrawn (ASH) — If you control 8 or more resources.
      return p.resources.length >= 8;
    case "LOF_017": // Darth Revan — If you control 5 or more resources.
    case "TWI_018": // Quinlan Vos — If you control 5 or more resources.
      return p.resources.length >= 5;
    case "JTL_018": // Kazuda Xiono — If you control 4 or more resources.
      return p.resources.length >= 4;
    case "JTL_004": // Rose Tico — If you control 5 or more resources.
    case "JTL_005": // Admiral Piett — If you control 5 or more resources.
    case "JTL_010": // Captain Phasma — If you control 5 or more resources.
    case "LOF_005": // Morgan Elsbeth — If you control 5 or more resources.
    case "LOF_014": // Grand Inquisitor — If you control 5 or more resources.
      return p.resources.length >= 5;
    case "LOF_015": // Cal Kestis — If you control 4 or more resources.
      return p.resources.length >= 4;
    case "LOF_009": // Darth Maul — If you control 6 or more resources.
    case "LOF_016": // Qui-Gon Jinn — If you control 6 or more resources.
      return p.resources.length >= 6;
    case "LOF_012": // Rey — If you control 7 or more resources.
      return p.resources.length >= 7;
    case "JTL_014": // Admiral Trench — Action [3 resources, Exhaust]: If you control 6 or more resources.
      return p.resources.length >= 6;
    case "SHD_014": // Cad Bane — If you control 6 or more resources.
    case "SHD_018": // The Mandalorian — If you control 6 or more resources.
      return p.resources.length >= 6;
    case "LOF_007": // Avar Kriss — If resources + times Used the Force this phase >= 9.
      return p.resources.length + game.roundState.forceUsedThisPhase >= 9;
    case "TWI_001": // Nala Se — If you control 4 or more resources.
    case "TWI_014": // Asajj Ventress — If you control 4 or more resources.
      return p.resources.length >= 4;
    case "SOR_015": // Boba Fett — If you control 5 or more resources.
    case "SHD_015": // Doctor Aphra — If you control 5 or more resources.
    case "TWI_006": // Wat Tambor — If you control 5 or more resources.
    case "TWI_016": // Jango Fett — If you control 5 or more resources.
      return p.resources.length >= 5;
    case "SOR_008": // Hera Syndulla — If you control 6 or more resources.
    case "SHD_001": // Gar Saxon — If you control 6 or more resources.
    case "TWI_002": // Nute Gunray — If you control 6 or more resources.
      return p.resources.length >= 6;
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
    // JTL_014 Admiral Trench deploys via "Action [3 resources, Exhaust]" — pay 3 on top of the
    // 6-resource condition (the only conditional-deploy leader that also has a resource cost).
    if (leader.cardId === "JTL_014") {
      if (spendableFor(game, player) < 3)
        return { response: invalidResponse("Not enough resources to deploy Admiral Trench."), pending: null, stateChanged: false };
      payResources(game, player, 3, log, leader.cardId);
    }
  } else {
    deployCost = playCost(game, player, leader.cardId);
    if (GetPlayer(game, player).resources.length < deployCost)
      return { response: invalidResponse("Not enough resources to deploy leader."), pending: null, stateChanged: false };
  }

  // Check if this leader can also deploy as a pilot upgrade on a Vehicle
  const pilotThreshold = LeaderDeployPilotThreshold(leader.cardId);
  if (pilotThreshold !== null) {
    const eligibleVehicles = PilotingEligibleVehicles(game, player, leader.cardId);
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
  // Support on a leader unit reads "When you deploy this leader, you may attack with another unit"
  // — same timing window as Shielded, so it queues here (ASH_009 Ahsoka, ASH_014 The Mandalorian).
  if (HasSupport(leader.cardId, unit.playId, player)) {
    game.triggerBag.push({ triggerType: "support", cardId: leader.cardId, fromPlayer: player, playId: unit.playId, nested });
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
    case "SEC_015": { // C-3PO (leader) — Action [1 resource, Exhaust]: If you control an exhausted
                      // unit, exhaust a unit. The "if" is a soft condition (soft-pass if unmet).
      if (!GetUnitsForPlayer(player).some(u => !u.ready)) {
        log.push(`${CardTitle("SEC_015")}: no exhausted unit controlled — soft pass.`);
        return null;
      }
      const allUnits015 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      if (allUnits015.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SEC_015",
        player,
        fromPlayIds: allUnits015.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "LOF_206": { // Babu Frik — Action [Exhaust]: attack with a friendly Droid unit; for that
                      // attack it deals damage equal to its remaining HP instead of its power.
      const droids206 = GetUnitsForPlayer(player, true)
        .filter(u => u.playId !== playId && TraitContains(u.cardId, "Droid", player, u.playId));
      if (droids206.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LOF_206",
        player,
        fromPlayIds: droids206.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
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
    case "SOR_010": { // Darth Vader — Action [1 resource, exhaust]: If you played a [Villainy] card
                      // this phase, deal 1 damage to a unit and 1 damage to a base.
      const playedVillainy = game.roundState.cardsPlayedThisPhase.some(
        c => c.fromPlayer === player && CardAspects(c.cardId).includes("Villainy"),
      );
      if (!playedVillainy) {
        log.push(`${CardTitle("SOR_010")}: no Villainy card played this phase — soft pass.`);
        return null;
      }
      // The base damage always happens; the unit damage only if there is a unit to hit.
      const baseStep010 = vaderBaseTargetPending(player);
      const units010 = GetAllUnits(game);
      if (units010.length === 0) return baseStep010;
      return {
        type: "ability-target",
        cardId: "SOR_010_leader",
        player,
        fromPlayIds: units010.map(u => u.playId),
        continuation: baseStep010,
      };
    }
    case "JTL_012": { // Luke Skywalker — Action [Exhaust]: If you attacked with a Fighter unit this
                      // phase, deal 1 damage to a unit.
      if (!UnitAttackedThisPhase(player, "Fighter")) {
        log.push(`${CardTitle("JTL_012")}: no Fighter attacked this phase — soft pass.`);
        return null;
      }
      const units012 = GetAllUnits(game);
      if (units012.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "JTL_012_leader",
        player,
        fromPlayIds: units012.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "JTL_004": { // Rose Tico — Action [Exhaust]: Heal 2 damage from a Vehicle unit that attacked
                      // this phase.
      const vehicles004 = AttackedThisPhasePlayIds({ trait: "Vehicle" });
      if (vehicles004.length === 0) {
        log.push(`${CardTitle("JTL_004")}: no Vehicle attacked this phase — soft pass.`);
        return null;
      }
      return {
        type: "ability-target",
        cardId: "JTL_004",
        player,
        fromPlayIds: vehicles004,
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "JTL_005": { // Admiral Piett — Action [Exhaust]: Play a Capital Ship unit from hand at -1.
      if (!GetPlayer(game, player).hand.some(c => CardTraits(c.cardId).includes("Capital Ship"))) {
        log.push(`${CardTitle("JTL_005")}: no Capital Ship in hand.`);
        return null;
      }
      return { type: "play-from-hand", cardId: "JTL_005", player } satisfies PlayFromHandPending;
    }
    case "JTL_014": { // Admiral Trench — Action [Exhaust]: Discard a card that costs 3 or more from
                      // your hand. If you do, draw a card.
      if (!GetPlayer(game, player).hand.some(c => (CardCost(c.cardId) ?? 0) >= 3)) {
        log.push(`${CardTitle("JTL_014")}: no card costing 3 or more in hand.`);
        return null;
      }
      return {
        type: "discard-from-hand",
        targetPlayer: player,
        count: 1,
        minCost: 3,
        thenDrawForPlayer: player,
        continuation: null,
      } satisfies DiscardFromHandPending;
    }
    case "JTL_010": { // Captain Phasma — Action [Exhaust]: If you played a First Order card this phase,
                      // deal 1 damage to a base.
      if (!CardWasPlayedThisPhase(player, "First Order")) {
        log.push(`${CardTitle("JTL_010")}: no First Order card played this phase — soft pass.`);
        return null;
      }
      return {
        type: "ability-target",
        cardId: "JTL_010",
        player,
        fromPlayIds: [],
        fromZones: ["Base"],
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "TWI_004": { // Yoda — Action [Exhaust]: If a unit left play this phase, draw a card, then
                      // put a card from your hand on the top or bottom of your deck.
      if (game.roundState.cardsLeftPlayThisPhase.length === 0) {
        log.push(`${CardTitle("TWI_004")}: no unit left play this phase — soft pass.`);
        return null;
      }
      DrawCardForPlayer(game, log, player);
      if (GetPlayer(game, player).hand.length === 0) return null;
      return { type: "hand-to-deck", cardId: "TWI_004", player, continuation: null };
    }
    case "TWI_007": { // Captain Rex — Action [2 resources, Exhaust]: If a friendly unit attacked
                      // this phase, create a Clone Trooper token.
      if (!UnitAttackedThisPhase(player)) {
        log.push(`${CardTitle("TWI_007")}: no friendly unit attacked this phase — soft pass.`);
        return null;
      }
      CreateCloneTrooper(game, player, log, "TWI_007");
      return null;
    }
    case "LOF_007": { // Avar Kriss — Action [Exhaust]: The Force is with you (create your Force token).
      CreateForceToken(player, log, "LOF_007");
      return null;
    }
    case "LOF_005": { // Morgan Elsbeth — Action [Exhaust]: Choose a friendly unit that attacked this
                      // phase. Play a hand unit that shares a keyword with it at -1.
      const attacked005 = AttackedThisPhasePlayIds({ player });
      if (attacked005.length === 0) {
        log.push(`${CardTitle("LOF_005")}: no friendly unit attacked this phase — soft pass.`);
        return null;
      }
      return {
        type: "ability-target",
        cardId: "LOF_005",
        player,
        fromPlayIds: attacked005,
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "TWI_002": { // Nute Gunray — Action [Exhaust]: If 2 or more friendly units were defeated
                      // this phase, create a Battle Droid token.
      if (UnitsDefeatedThisPhaseCount(player) < 2) {
        log.push(`${CardTitle("TWI_002")}: fewer than 2 friendly units defeated this phase — soft pass.`);
        return null;
      }
      CreateBattleDroid(game, player, log, "TWI_002");
      return null;
    }
    case "TWI_006": { // Wat Tambor — Action [Exhaust]: If a friendly unit was defeated this phase,
                      // give a unit +2/+2 for this phase.
      if (!UnitWasDefeatedThisPhase(player)) {
        log.push(`${CardTitle("TWI_006")}: no friendly unit defeated this phase — soft pass.`);
        return null;
      }
      const units006 = GetAllUnits(game);
      if (units006.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "TWI_006_leader",
        player,
        fromPlayIds: units006.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "JTL_018": { // Kazuda Xiono — Action [Exhaust]: A friendly unit loses all abilities for this round. Take an extra action after this one.
      const friendly018 = GetUnitsForPlayer(player);
      if (friendly018.length === 0) return null;
      // The extra action is granted by using the ability, independent of the target choice.
      game.roundState.extraActionPlayer = player;
      return {
        type: "ability-target",
        cardId: "JTL_018_leader",
        player,
        fromPlayIds: friendly018.map(u => u.playId),
        continuation: null,
      };
    }
    case "LAW_013": { // Chewbacca — Action [1 resource, Exhaust, defeat a friendly resource]: Deal 2 damage to a unit and create a Credit token.
      const resources013 = GetPlayer(game, player).resources;
      if (resources013.length === 0) return null;
      // Step 1: pick the resource to defeat (the remaining cost).
      return {
        type: "ability-target",
        cardId: "LAW_013_resource",
        player,
        fromPlayIds: resources013.map(r => r.playId),
        continuation: null,
      };
    }
    case "JTL_013": { // Poe Dameron — "Flip this leader and attach him as an upgrade to a friendly
                      // Vehicle unit without a Pilot on it." An ATTACH, so the Falcon's and R2's
                      // "play or deploy 1 additional Pilot" permissions do not apply: the target
                      // must carry no Pilot at all.
      const vehicles013 = PilotlessVehiclePlayIds(game, player);
      if (vehicles013.length === 0) return null;
      const leader013 = GetPlayer(game, player).leader;
      leader013.deployed = true; // flipped — he is now the upgrade, not the leader card
      log.push(`${CardTitle("JTL_013")}: flipped and attaching as a Pilot upgrade.`);
      return {
        type: "upgrade-target",
        upgradeCardId: "JTL_013",
        player,
        fromPlayIds: vehicles013,
      } satisfies UpgradeTargetPending;
    }
    case "SEC_004": { // Leia Organa (leader side) — disclose one of the five aspects, then give an
                      // Experience token to a unit that doesn't share an aspect with that card.
      if (!CanDiscloseAnyOf(player, SEC_004_ASPECTS)) return null;
      return { type: "play-from-hand", cardId: "SEC_004", player } satisfies PlayFromHandPending;
    }
    case "LAW_010": { // Leia Organa (leader side) — Action [2 resources, Exhaust]: for this phase,
                      // give a unit +1/+1 for each different aspect it has.
      const allUnits010 = GetAllUnits(game);
      if (allUnits010.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LAW_010",
        player,
        fromPlayIds: allUnits010.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "ASH_009": { // Ahsoka Tano (leader side) — Action [Exhaust]: Choose a unit with less power
                      // than a friendly unit. It gets +2/+0 for this phase.
      const eligible009 = WeakerThanAFriendlyUnitPlayIds(player);
      if (eligible009.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "ASH_009_leader",
        player,
        fromPlayIds: eligible009,
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "LOF_002": { // Mother Talzin (leader side) — Action [Exhaust, use the Force]: Give a unit -1/-1.
      if (!UseTheForce(player, log, "LOF_002")) return null; // no token → the cost can't be paid
      const allUnits002 = GetAllUnits(game);
      if (allUnits002.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LOF_002",
        player,
        fromPlayIds: allUnits002.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "LOF_009": { // Darth Maul — Action [Exhaust, use the Force]: Deal 1 damage to a unit and 1
                      // damage to a different unit.
      if (!UseTheForce(player, log, "LOF_009")) return null; // no token → the cost can't be paid
      return buildMaulSpread(game, player, null);
    }
    case "LOF_012": { // Rey — Action [Exhaust]: If you played a non-unit Force card this phase, deal
                      // 1 damage to a unit.
      const playedNonUnitForce = game.roundState.cardsPlayedThisPhase.some(
        c => c.fromPlayer === player && CardType(c.cardId) !== "Unit" && CardTraits(c.cardId).includes("Force"),
      );
      if (!playedNonUnitForce) {
        log.push(`${CardTitle("LOF_012")}: no non-unit Force card played this phase — soft pass.`);
        return null;
      }
      const units012r = GetAllUnits(game);
      if (units012r.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LOF_012",
        player,
        fromPlayIds: units012r.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "LOF_016": { // Qui-Gon Jinn — Action [Exhaust, use the Force]: Return a friendly non-leader
                      // unit to its owner's hand. Play a non-Villainy unit that costs less than the
                      // returned unit from your hand for free.
      if (!UseTheForce(player, log, "LOF_016")) return null; // no token → the cost can't be paid
      return buildQuiGonReturn(game, player, null);
    }
    case "LOF_015": { // Cal Kestis — Action [Exhaust, use the Force]: An opponent chooses a ready unit
                      // they control. Exhaust that unit.
      if (!UseTheForce(player, log, "LOF_015")) return null; // no token → the cost can't be paid
      const opp015 = GetOtherPlayer(player);
      const readyEnemy015 = GetUnitsForPlayer(opp015).filter(u => u.ready);
      if (readyEnemy015.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LOF_015",
        player,
        fromPlayIds: readyEnemy015.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "LOF_014": { // Grand Inquisitor — Action [Exhaust, use the Force]: Attack with a friendly
                      // unit. The defender gets -2/-0 for this attack.
      if (!UseTheForce(player, log, "LOF_014")) return null; // no token → the cost can't be paid
      const ready014 = GetUnitsForPlayer(player).filter(u => u.ready);
      if (ready014.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LOF_014",
        player,
        fromPlayIds: ready014.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
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
      game.player1.base.damage += CapBaseDamage(1, 1);
      game.player2.base.damage += CapBaseDamage(2, 1);
      log.push(`${CardTitle(cardId)} dealt 1 damage to each base.`);
      return null;
    case "TWI_012": { // Anakin Skywalker — Action [Exhaust, deal 2 damage to your base]: Attack with a unit. +2/+0 if attacking a unit.
      GetPlayer(game, player).base.damage += CapBaseDamage(player, 2);
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
    case "TWI_014": { // Asajj Ventress — Action [Exhaust]: Attack with a unit. If you played an event
                      // this phase, it gets +1/+0 for this attack.
      const readyUnits014 = GetUnitsForPlayer(player).filter(u => u.ready);
      if (readyUnits014.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "TWI_014_leader",
        player,
        fromPlayIds: readyUnits014.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "TWI_011": { // Ahsoka Tano — Coordinate — Action [Exhaust]: Attack with a unit. It gets +1/+0 for this attack.
      const readyUnits011 = GetUnitsForPlayer(player).filter(u => u.ready);
      if (readyUnits011.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "TWI_011",
        player,
        fromPlayIds: readyUnits011.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "ASH_004": { // Grand Admiral Thrawn (leader) — Action [Exhaust]: Attack with a unit. It
                      // gains Restore 2 for this attack if you control the same number of units as
                      // the defending player.
      const readyUnits004 = GetUnitsForPlayer(player).filter(u => u.ready);
      if (readyUnits004.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "ASH_004_leader",
        player,
        fromPlayIds: readyUnits004.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "SOR_012": { // IG-88 — Action [Exhaust]: Attack with a unit. If you control more units than
                      // the defending player, the attacker gets +1/+0 for this attack.
      const readyUnitsIg88 = GetUnitsForPlayer(player).filter(u => u.ready);
      if (readyUnitsIg88.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_012_leader",
        player,
        fromPlayIds: readyUnitsIg88.map(u => u.playId),
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
    case "ASH_142": { // Mortar Trooper — Action [Exhaust]: Deal 1 damage to each of up to 3 ground units.
      const groundUnits142 = [...game.player1.groundArena, ...game.player2.groundArena];
      if (groundUnits142.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "ASH_142",
        player,
        fromPlayIds: groundUnits142.map(u => u.playId),
        needsMultiple: true,
        maxTargets: 3,
        continuation: null,
      } satisfies AbilityTargetPending;
    }
    case "ASH_109": { // T-6 Shuttle 1974 — Action [Exhaust]: Give another unit +2/+2 for this phase.
                      // You may attack with that unit.
      const others109 = GetAllUnits(game).filter(u => u.playId !== playId);
      if (others109.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "ASH_109",
        player,
        fromPlayIds: others109.map(u => u.playId),
        continuation: null,
      } satisfies AbilityTargetPending;
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
    case "TWI_004": { // Yoda — defeat an enemy non-leader unit costing ≤ the discarded card's cost.
      const milled004 = pending.milledCardIds[0];
      if (!milled004) return pending.continuation ?? null;
      const maxCost004 = CardCost(milled004) ?? 0;
      const enemy004 = GetUnitsForPlayer(pending.player === 1 ? 2 : 1).filter(
        u => !Unit.FromInterface(u).IsLeader() && (CardCost(u.cardId) ?? 0) <= maxCost004,
      );
      if (enemy004.length === 0) {
        log.push(`${CardTitle("TWI_004")}: no enemy unit costs ${maxCost004} or less.`);
        return pending.continuation ?? null;
      }
      return {
        type: "ability-target",
        cardId: "TWI_004_defeat",
        player: pending.player,
        fromPlayIds: enemy004.map(u => u.playId),
        continuation: pending.continuation ?? null,
      };
    }
    case "LAW_173": { // BT-1 — if the milled card is Aggression, you may deal 1 damage to a ground unit.
      const aggressionMilled = pending.milledCardIds.some((id: string) => CardAspects(id).includes("Aggression"));
      if (!aggressionMilled) break;
      const ground173 = AllGroundUnits();
      if (ground173.length === 0) break;
      return {
        type: "ability-option",
        cardId: "LAW_173",
        player: pending.player,
        helperText: "Milled an Aggression card — deal 1 damage to a ground unit?",
        yesLabel: "Deal 1",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "LAW_173",
          player: pending.player,
          fromPlayIds: ground173.map(u => u.playId),
          continuation: pending.continuation ?? null,
        },
        continuation: pending.continuation ?? null,
      };
    }
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
      if (healAmount > 0 && !BaseHealingPrevented()) { // TWI_132 Confederate Tri-Fighter
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
    if (BaseHealingPrevented()) return; // TWI_132 Confederate Tri-Fighter
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
  /** Which base the player picked, when the card lets them choose either one ("a base"). */
  targetBasePlayer?: PlayerId,
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
    case "ASH_188": { // Galvanized Leap — ready the chosen unit (damaged this phase).
      if (!targetPlayId) break;
      const target188 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target188) ReadyUnitByPlayId(targetPlayId, target188.controller, "ASH_188");
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
    case "SHD_178": // Daring Raid — deal 2 damage to the chosen unit or base (TWI_170 is identical).
    case "TWI_170": {
      // A base target may arrive either as a "playerN.base" playId or (from the UI) as the
      // targetIsBase flag + targetBasePlayer. Honour both, or bases become untargetable.
      let basePlayer178: PlayerId | null = null;
      if (targetPlayId === "player1.base") basePlayer178 = 1;
      else if (targetPlayId === "player2.base") basePlayer178 = 2;
      else if (targetIsBase) basePlayer178 = targetBasePlayer ?? null;
      if (basePlayer178 !== null) {
        dealBaseDamage(game.currentGameState, basePlayer178, 2, pending.player);
        game.gameLog.push(`${CardTitle(pending.cardId)}: dealt 2 damage to player ${basePlayer178}'s base.`);
      } else {
        if (!targetPlayId) break;
        DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
      }
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
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
    case "SEC_015": { // C-3PO (both sides) — exhaust the chosen unit.
      if (!targetPlayId) break;
      const target015 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target015) {
        target015.ready = false;
        game.gameLog.push(`${CardTitle("SEC_015")}: exhausted ${CardTitle(target015.cardId)}.`);
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
    case "TS26_058": { // Backed by the Pykes — step 1: give an Experience token to the chosen friendly unit,
                       // then offer the optional damage (equal to friendly Experience-token count).
      if (!targetPlayId || pending.player === undefined) break;
      const target058 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target058) {
        target058.upgrades.push({ cardId: "SOR_T01", playId: nextPlayId(game.currentGameState), owner: target058.owner, controller: target058.controller });
        game.gameLog.push(`${CardTitle("TS26_058")}: gave an Experience token to ${CardTitle(target058.cardId)}.`);
      }
      const xpCount058 = GetUnitsForPlayer(pending.player).reduce(
        (sum, u) => sum + u.upgrades.filter(up => up.cardId === "SOR_T01").length, 0);
      const allUnits058 = GetAllUnits(game.currentGameState);
      if (xpCount058 <= 0 || allUnits058.length === 0) break;
      return {
        type: "ability-option",
        cardId: "TS26_058_damage",
        player: pending.player,
        helperText: `Deal ${xpCount058} damage to a unit?`,
        yesLabel: `Deal ${xpCount058}`,
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "TS26_058_damage",
          player: pending.player,
          fromPlayIds: allUnits058.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    }
    case "TS26_058_damage": { // Backed by the Pykes — step 2: deal damage equal to friendly Experience-token count.
      if (!targetPlayId || pending.player === undefined) break;
      const xpCount058b = GetUnitsForPlayer(pending.player).reduce(
        (sum, u) => sum + u.upgrades.filter(up => up.cardId === "SOR_T01").length, 0);
      DealDamageToUnit(game.currentGameState, "TS26_058", targetPlayId, xpCount058b, game.gameLog);
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
    case "SOR_010": { // Darth Vader (deployed) On Attack: deal 2 damage to chosen unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
      break;
    }
    case "ASH_102": { // Ravager: the played unit deals its power to the chosen unit in its arena
      if (!targetPlayId) break;
      const source102 = pending.sourcePlayId ? GetUnitByPlayId(game.currentGameState, pending.sourcePlayId) : null;
      const amount102 = pending.amount ?? 0;
      if (!source102 || amount102 <= 0) break;
      DealDamageToUnit(game.currentGameState, source102.cardId, targetPlayId, amount102, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "LAW_170_friendly": { // Double-Cross step 1: the friendly unit is chosen; now pick the enemy one.
      if (!targetPlayId) break;
      const player170 = pending.player!;
      const opponent170: PlayerId = player170 === 1 ? 2 : 1;
      const enemy170 = GetUnitsForPlayer(opponent170).filter(u => !Unit.FromInterface(u).IsLeader());
      if (enemy170.length === 0) break;
      return {
        type: "ability-target",
        cardId: "LAW_170_enemy",
        player: player170,
        sourcePlayId: targetPlayId, // remember the friendly unit
        fromPlayIds: enemy170.map(u => u.playId),
        continuation: pending.continuation,
      } satisfies AbilityTargetPending;
    }
    case "LAW_170_enemy": { // Double-Cross step 2: exchange control, then hand out the Credits.
      if (!targetPlayId || !pending.sourcePlayId) break;
      const player170e = pending.player!;
      const opponent170e: PlayerId = player170e === 1 ? 2 : 1;
      const gs170 = game.currentGameState;
      const friendlyUnit = GetUnitByPlayId(gs170, pending.sourcePlayId);
      const enemyUnit = GetUnitByPlayId(gs170, targetPlayId);
      if (!friendlyUnit || !enemyUnit) break;

      const friendlyCost = CardCost(friendlyUnit.cardId) ?? 0;
      const enemyCost = CardCost(enemyUnit.cardId) ?? 0;

      transferControl(gs170, game.gameLog, Unit.FromInterface(friendlyUnit), opponent170e);
      transferControl(gs170, game.gameLog, Unit.FromInterface(enemyUnit), player170e);

      // Whoever received the cheaper unit is compensated with the cost difference in Credits.
      const diff170 = Math.abs(friendlyCost - enemyCost);
      if (diff170 > 0) {
        // You gave away the friendly unit and took the enemy one.
        const takerOfCheaper = enemyCost < friendlyCost ? player170e : opponent170e;
        for (let i = 0; i < diff170; i++) {
          CreateCreditToken(gs170, takerOfCheaper, game.gameLog, "LAW_170");
        }
      }
      return pending.continuation;
    }
    case "SEC_188": { // Darth Traya On Attack: ready the chosen non-unit leader
      const leaderMatch188 = targetPlayId?.match(/^player([12])\.leader$/);
      if (!leaderMatch188) break;
      const leaderPlayer188 = Number(leaderMatch188[1]) as PlayerId;
      const leader188 = GetPlayer(game.currentGameState, leaderPlayer188).leader;
      if (leader188.deployed) break; // "non-unit leader" only
      leader188.ready = true;
      game.gameLog.push(`${CardTitle("SEC_188")}: readied Player ${leaderPlayer188}'s leader.`);
      break;
    }
    case "JTL_147": { // Black One On Attack: deal 1 damage to the chosen unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "JTL_147", targetPlayId, 1, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "JTL_151": { // Red Five On Attack: deal 2 damage to the chosen damaged unit
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "JTL_151", targetPlayId, 2, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "ASH_009":        // Ahsoka Tano (deployed) On Attack — the chosen weaker unit gets +2/+0.
    case "ASH_009_leader": { // …and her leader-side Action does the same.
      if (!targetPlayId) break;
      const target009 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target009) GivePowerMod("ASH_009", target009, 2, "Phase", game.gameLog);
      break;
    }
    case "ASH_174": { // StarFortress Heavy Bomber — deal 6 damage to the chosen non-unique ground unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "ASH_174", targetPlayId, 6, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
    }
    case "ASH_171": { // Pegasus Tri-Wing — defeat the chosen friendly upgrade, then ready this unit.
      if (!targetPlayId) break;
      const self171 = pending.sourcePlayId ? GetUnitByPlayId(game.currentGameState, pending.sourcePlayId) : null;
      if (self171) self171.ready = true;
      return defeatUpgradeByPlayId(
        game.currentGameState, game.gameLog, targetPlayId,
        CardTitle("ASH_171"), pending.continuation ?? null, pending.player,
      );
    }
    case "ASH_170": { // Desert Sharpshooter — deal 2 damage to the chosen upgraded ground unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "ASH_170", targetPlayId, 2, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
    }
    case "ASH_167": { // Flarestar Attack Shuttle — give an Advantage token to the chosen unit.
      if (!targetPlayId) break;
      const target167 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target167) GiveAdvantageTokens(game.currentGameState, target167, 1, game.gameLog, "ASH_167");
      break;
    }
    case "ASH_158": { // Han Solo — give 3 Advantage tokens to the chosen unit.
      if (!targetPlayId) break;
      const target158 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target158) GiveAdvantageTokens(game.currentGameState, target158, 3, game.gameLog, "ASH_158");
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
    }
    case "ASH_157": { // Danger Squadron Wingmen — give an Advantage token to the chosen unit.
      if (!targetPlayId) break;
      const target157 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target157) GiveAdvantageTokens(game.currentGameState, target157, 1, game.gameLog, "ASH_157");
      break;
    }
    case "ASH_165": { // Clan Vizsla Soldier — When Defeated: defeat the chosen upgrade.
      if (!targetPlayId) break;
      return defeatUpgradeByPlayId(
        game.currentGameState, game.gameLog, targetPlayId,
        CardTitle("ASH_165"), pending.continuation ?? null, pending.player,
      );
    }
    case "ASH_153": { // Green Leader — When Defeated: deal 2 damage to the chosen unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "ASH_153", targetPlayId, 2, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
    }
    case "ASH_147": { // The Cyborg Mech — 2 damage if the chosen ground unit is undamaged, 5 if damaged.
      if (!targetPlayId) break;
      const target147 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target147) break;
      const amount147 = Unit.FromInterface(target147).IsDamaged() ? 5 : 2;
      DealDamageToUnit(game.currentGameState, "ASH_147", targetPlayId, amount147, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
    }
    case "ASH_146_advantage": { // Justifier follow-up — give an Advantage token to the chosen unit.
      if (!targetPlayId) break;
      const advTarget146 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (advTarget146) GiveAdvantageTokens(game.currentGameState, advTarget146, 1, game.gameLog, "ASH_146");
      break;
    }
    case "ASH_146": { // Justifier — deal 1 damage to the chosen unit; if defeated this way, give an Advantage token to a unit.
      if (!targetPlayId) break;
      const target146 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target146) break;
      const wasAlready0_146 = Unit.FromInterface(target146).CurrentHP() <= 0;
      DealDamageToUnit(game.currentGameState, "ASH_146", targetPlayId, 1, game.gameLog);
      const nowDead146 = !wasAlready0_146 && Unit.FromInterface(target146).CurrentHP() <= 0;
      if (!nowDead146) {
        return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
      }
      const afterSweep146 = sweepDeadUnits(game.currentGameState, game.gameLog, null);
      const allUnits146 = GetAllUnits(game.currentGameState);
      if (allUnits146.length === 0) {
        return afterSweep146 ? injectContinuation(afterSweep146, pending.continuation ?? null) : (pending.continuation ?? null);
      }
      const advPending146: AbilityTargetPending = {
        type: "ability-target",
        cardId: "ASH_146_advantage",
        player: pending.player,
        fromPlayIds: allUnits146.map(u => u.playId),
        continuation: pending.continuation ?? null,
      };
      return afterSweep146 ? injectContinuation(afterSweep146, advPending146) : advPending146;
    }
    case "ASH_132": { // Queen Soruna — deal 3 damage to the chosen (same-cost) unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "ASH_132", targetPlayId, 3, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
    }
    case "ASH_109": { // T-6 Shuttle 1974 — Action: give the chosen unit +2/+2 for this phase.
                      // You may attack with that unit.
      if (!targetPlayId) break;
      const target109 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target109) break;
      GiveStatModForPhase("ASH_109", target109, 2, game.gameLog);
      if (target109.ready && CanUnitAttack(target109)) {
        return {
          type: "ability-option",
          cardId: "ASH_109",
          helperText: `Attack with ${CardTitle(target109.cardId)}?`,
          yesLabel: "Attack",
          noLabel: "Skip",
          onYes: {
            type: "attack-target",
            attackerPlayId: target109.playId,
            source: "ASH_109",
            continuation: null,
          },
          continuation: null,
        } satisfies AbilityOptionPending;
      }
      break;
    }
    case "TWI_006":        // Wat Tambor (deployed) On Attack — give another unit +2/+2 this phase.
    case "TWI_006_leader": { // …and his leader-side Action does the same.
      if (!targetPlayId) break;
      const target006 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target006) GiveStatModForPhase("TWI_006", target006, 2, game.gameLog);
      break;
    }
    case "ASH_036": { // Rukh When Attack Ends: give 3 Advantage tokens to the chosen unit.
      if (!targetPlayId) break;
      const target036 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target036) GiveAdvantageTokens(game.currentGameState, target036, 3, game.gameLog, "ASH_036");
      break;
    }
    case "ASH_050": { // Morgan Elsbeth When Defeated: give the chosen unit –2/–2 for this phase.
      if (!targetPlayId) break;
      const target050 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target050) GiveStatModForPhase("ASH_050", target050, -2, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "LOF_206": { // Babu Frik — the chosen friendly Droid attacks, dealing damage equal to its
                      // remaining HP instead of its power. Mark it with a ForAttack effect the
                      // combat step reads, then send it into a normal attack.
      if (!targetPlayId) break;
      game.currentGameState.currentEffects.push({
        cardId: "LOF_206_hp_as_damage",
        duration: "ForAttack",
        affectedPlayer: pending.player!,
        targetPlayId,
      });
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "LOF_206",
        continuation: null,
      };
    }
    case "LAW_101": { // Lawbringer — the chosen aspect arrives as targetPlayId; give each enemy unit
                      // with that aspect –2/–2 for this phase.
      const aspect101 = targetPlayId;
      if (!aspect101) break;
      const opp101 = pending.player === 1 ? 2 : 1;
      for (const enemy of GetUnitsForPlayer(opp101)) {
        if (CardAspects(enemy.cardId).includes(aspect101)) {
          GiveStatModForPhase("LAW_101", enemy, -2, game.gameLog);
        }
      }
      break;
    }
    case "ASH_209": { // Ezra Bridger On Attack: give the chosen unit –3/–0 for this phase.
      if (!targetPlayId) break;
      const target209 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target209) GivePowerMod("ASH_209", target209, -3, "Phase", game.gameLog);
      break;
    }
    case "LAW_079": { // K-2SO On Attack: deal 3 damage to the chosen damaged ground unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "LAW_079", targetPlayId, 3, game.gameLog);
      break;
    }
    case "ASH_043": { // Corona Four On Attack: give the chosen unit –2/–0 for this phase.
      if (!targetPlayId) break;
      const target043 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target043) GivePowerMod("ASH_043", target043, -2, "Phase", game.gameLog);
      break;
    }
    case "ASH_056": { // Huyang On Attack: give the chosen upgraded unit –4/–0 for this phase.
      if (!targetPlayId) break;
      const target056 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target056) GivePowerMod("ASH_056", target056, -4, "Phase", game.gameLog);
      break;
    }
    case "ASH_253": { // Yellow Aces Bomber On Attack: deal 2 damage to the chosen base ("a base" — either one).
      const owner253 = pending.player!;
      let basePlayer253: PlayerId | null = null;
      if (targetPlayId === "player1.base") basePlayer253 = 1;
      else if (targetPlayId === "player2.base") basePlayer253 = 2;
      else if (targetIsBase) basePlayer253 = targetBasePlayer ?? (owner253 === 1 ? 2 : 1);
      if (basePlayer253 === null) break;
      dealBaseDamage(game.currentGameState, basePlayer253, 2, owner253);
      game.gameLog.push(`${CardTitle("ASH_253")}: dealt 2 damage to player ${basePlayer253}'s base.`);
      break;
    }
    case "LOF_048": { // Itinerant Warrior When Played: use the Force, then heal 3 from the chosen base.
      const owner048 = pending.player!;
      let basePlayer048: PlayerId | null = null;
      if (targetPlayId === "player1.base") basePlayer048 = 1;
      else if (targetPlayId === "player2.base") basePlayer048 = 2;
      else if (targetIsBase) basePlayer048 = targetBasePlayer ?? (owner048 === 1 ? 2 : 1);
      if (basePlayer048 === null) break;
      // "If you do" — the heal only happens when the Force token is actually spent.
      if (!UseTheForce(owner048, game.gameLog, "LOF_048")) break;
      HealBaseForPlayer(game.currentGameState, basePlayer048, 3, game.gameLog, "LOF_048");
      break;
    }
    case "LAW_078": // Sabine Wren (Spectre Five) When Played: defeat the chosen upgrade.
    case "SEC_163": { // Outer Rim Constable When Played: defeat the chosen upgrade
      if (!targetPlayId) break;
      return defeatUpgradeByPlayId(
        game.currentGameState, game.gameLog, targetPlayId,
        CardTitle(pending.cardId), pending.continuation ?? null, pending.player,
      );
    }
    case "SOR_010_leader": { // Darth Vader leader ability: 1 damage to the chosen unit…
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_010", targetPlayId, 1, game.gameLog);
      // …then the base step, which is already this pending's continuation.
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "SOR_010_leader_base": { // …and 1 damage to the chosen base ("a base" — either one).
      const owner010 = pending.player!;
      let basePlayer010: PlayerId | null = null;
      if (targetPlayId === "player1.base") basePlayer010 = 1;
      else if (targetPlayId === "player2.base") basePlayer010 = 2;
      else if (targetIsBase) basePlayer010 = targetBasePlayer ?? (owner010 === 1 ? 2 : 1);
      if (basePlayer010 === null) break;
      dealBaseDamage(game.currentGameState, basePlayer010, 1, owner010);
      game.gameLog.push(`${CardTitle("SOR_010")}: dealt 1 damage to player ${basePlayer010}'s base.`);
      break;
    }
    case "JTL_010": // Captain Phasma (front) — deal 1 to the chosen base.
    case "JTL_010_base": { // Captain Phasma (deployed) — "if you do, deal 1 damage to a base".
      const owner10 = pending.player!;
      let basePlayer10: PlayerId | null = null;
      if (targetPlayId === "player1.base") basePlayer10 = 1;
      else if (targetPlayId === "player2.base") basePlayer10 = 2;
      else if (targetIsBase) basePlayer10 = targetBasePlayer ?? (owner10 === 1 ? 2 : 1);
      if (basePlayer10 !== null) {
        dealBaseDamage(game.currentGameState, basePlayer10, 1, owner10);
        game.gameLog.push(`${CardTitle("JTL_010")}: dealt 1 damage to player ${basePlayer10}'s base.`);
      }
      return pending.continuation;
    }
    case "JTL_010_unit": { // Captain Phasma (deployed) — deal 1 to the chosen unit, then the base step.
      if (targetPlayId) DealDamageToUnit(game.currentGameState, "JTL_010", targetPlayId, 1, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
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
    case "support": { // Support: the chosen unit attacks, gaining the supporter's other abilities.
      if (!targetPlayId) break;
      const gsSupport = game.currentGameState;
      const supporter = GetUnitByPlayId(gsSupport, pending.sourcePlayId!);
      if (!supporter) break;
      // Cleared automatically when this attack ends (every ForAttack effect on the attacker is).
      gsSupport.currentEffects.push({
        cardId: SupportGrantEffectCardId(supporter.cardId),
        duration: "ForAttack",
        affectedPlayer: supporter.controller,
        targetPlayId,
      });
      game.gameLog.push(
        `${CardTitle(supporter.cardId)}: Support — ${CardTitle(GetUnitByPlayId(gsSupport, targetPlayId)?.cardId ?? "")} attacks and gains its abilities for this attack.`,
      );
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "support",
        continuation: pending.continuation,
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
    case "JTL_231": { // Punch It: give the chosen Vehicle +2/+0 for this attack, then attack with it.
      if (!targetPlayId) break;
      const unit231 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!unit231) break;
      GivePowerMod("JTL_231", unit231, 2, "ForAttack", game.gameLog);
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "JTL_231",
        continuation: pending.continuation,
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
    case "JTL_012_leader": { // Luke Skywalker leader ability: 1 damage to the chosen unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "JTL_012", targetPlayId, 1, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "JTL_012_pilot": { // Luke as a Pilot upgrade — granted On Attack: deal 3 damage to a unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "JTL_012", targetPlayId, 3, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "TWI_004_defeat": { // Yoda When Deployed: defeat the chosen enemy unit.
      if (!targetPlayId) break;
      const target004 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target004) break;
      if (CardIsLeader(target004.cardId)) break;
      const defeatPend004 = defeatUnit(game.currentGameState, game.gameLog, target004);
      game.gameLog.push(`${CardTitle("TWI_004")} defeated ${CardTitle(target004.cardId)}.`);
      if (defeatPend004) return injectContinuation(defeatPend004, pending.continuation);
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
    case "LOF_037": { // Darth Vader When Played — give a Shield token to the chosen unit (runs
                      // twice: once for the friendly target, once for the enemy via continuation).
      if (!targetPlayId) break;
      const target037 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target037) break;
      target037.upgrades.push({ cardId: "SOR_T02", playId: nextPlayId(game.currentGameState), owner: target037.owner, controller: target037.controller });
      game.gameLog.push(`${CardTitle("LOF_037")}: Shield token placed on ${CardTitle(target037.cardId)}.`);
      break;
    }
    case "LOF_037_OA": { // Darth Vader On Attack — defeat the chosen enemy unit that has a Shield.
      if (!targetPlayId) break;
      const target037OA = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target037OA) break;
      game.gameLog.push(`${CardTitle("LOF_037")}: defeated ${CardTitle(target037OA.cardId)} (Shielded).`);
      const defeat037 = defeatUnit(game.currentGameState, game.gameLog, target037OA);
      if (defeat037) return injectContinuation(defeat037, pending.continuation ?? null);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation ?? null);
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
    case "LAW_019_cost": { // Alliance Outpost — the cost: defeat the chosen friendly token.
      if (!targetPlayId) break;
      const gs019 = game.currentGameState;
      const tokenUnit = GetUnitByPlayId(gs019, targetPlayId);
      if (tokenUnit) {
        defeatUnit(gs019, game.gameLog, tokenUnit);
      } else {
        defeatUpgradeByPlayId(gs019, game.gameLog, targetPlayId, CardTitle("LAW_019"), null, pending.player);
      }
      updateDefeatedPlayers(gs019);
      return {
        type: "choose-one",
        cardId: "LAW_019",
        player: pending.player!,
        options: [
          { id: "experience", label: "Give an Experience token to a unit" },
          { id: "shield", label: "Give a Shield token to a unit" },
          { id: "credit", label: "Create a Credit token" },
        ],
        continuation: null,
      } satisfies ChooseOnePending;
    }
    case "LAW_019_experience": // Alliance Outpost — give the chosen token to the chosen unit.
    case "LAW_019_shield": {
      if (!targetPlayId) break;
      const target019 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target019) {
        const tokenCardId = pending.cardId === "LAW_019_experience" ? "SOR_T01" : "SOR_T02";
        target019.upgrades.push({
          cardId: tokenCardId,
          playId: nextPlayId(game.currentGameState),
          owner: target019.owner,
          controller: target019.controller,
        });
        game.gameLog.push(`${CardTitle("LAW_019")}: gave a ${CardTitle(tokenCardId)} token to ${CardTitle(target019.cardId)}.`);
      }
      break;
    }
    case "LOF_128": { // Protect the Pod — step 1: chose the friendly non-Vehicle unit, now pick the enemy.
      if (!targetPlayId || !pending.player) break;
      const enemy128 = chooseEnemyForPowerDamage("LOF_128_deal", pending.player, targetPlayId, game.currentGameState);
      if (enemy128) return enemy128;
      break;
    }
    case "LOF_128_deal": { // Protect the Pod — step 2: deal the friendly unit's REMAINING HP to it.
      if (!targetPlayId || !pending.sourcePlayId) break;
      dealRemainingHpToEnemy(game.currentGameState, game.gameLog, CardTitle("LOF_128"), pending.sourcePlayId, targetPlayId);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
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
      const lukePending = defeatUpgradeByPlayId(game.currentGameState, game.gameLog, targetPlayId, "Confiscate", pending.continuation ?? null, pending.player);
      if (lukePending) return lukePending;
      break;
    }
    case "SHD_147_defeat_upgrade": { // Ketsu Onyo — after combat damage to a base, defeat an upgrade costing 2 or less
      if (!targetPlayId) break;
      const lukePending147 = defeatUpgradeByPlayId(game.currentGameState, game.gameLog, targetPlayId, CardTitle("SHD_147"), pending.continuation ?? null, pending.player);
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
        GetPlayer(game.currentGameState, opp142).base.damage += CapBaseDamage(opp142, 1);
        game.gameLog.push(`${CardTitle("SOR_142")}: dealt 1 damage to player ${opp142}'s base.`);
      } else if (targetPlayId) {
        const baseMatch142 = targetPlayId.match(/^player([12])\.base$/);
        if (baseMatch142) {
          const basePlayer142 = Number(baseMatch142[1]) as PlayerId;
          GetPlayer(game.currentGameState, basePlayer142).base.damage += CapBaseDamage(basePlayer142, 1);
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
    case "JTL_004": { // Rose Tico (both sides) — heal 2 from the chosen Vehicle unit.
      if (!targetPlayId) return pending.continuation;
      healTarget(game.currentGameState, targetPlayId, 2, game.gameLog, "JTL_004");
      return pending.continuation;
    }
    case "LOF_009_a": { // Darth Maul — deal 1 to the first chosen unit, then target a different unit.
      if (!targetPlayId) return pending.continuation;
      DealDamageToUnit(game.currentGameState, "LOF_009", targetPlayId, 1, game.gameLog);
      const others009 = GetAllUnits(game.currentGameState).filter(u => u.playId !== targetPlayId);
      const secondStep = others009.length > 0
        ? {
            type: "ability-target" as const,
            cardId: "LOF_009_b",
            player: pending.player!,
            fromPlayIds: others009.map(u => u.playId),
            continuation: pending.continuation,
          }
        : pending.continuation;
      return sweepDeadUnits(game.currentGameState, game.gameLog, secondStep);
    }
    case "LOF_009_b": { // Darth Maul — deal 1 to the second (different) chosen unit.
      if (targetPlayId) DealDamageToUnit(game.currentGameState, "LOF_009", targetPlayId, 1, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "LOF_012": { // Rey (front) — deal 1 damage to the chosen unit.
      if (targetPlayId) DealDamageToUnit(game.currentGameState, "LOF_012", targetPlayId, 1, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "LOF_016_return": { // Qui-Gon Jinn — return the chosen friendly non-leader unit to hand, then
                             // set up the free play of a cheaper non-Villainy unit.
      if (!targetPlayId || !pending.player) return pending.continuation;
      const removed016 = removeFromArena(game.currentGameState, targetPlayId);
      if (!removed016) return pending.continuation;
      const returnedCost016 = CardCost(removed016.unit.cardId) ?? 0;
      if (!removed016.unit.IsTokenUnit()) {
        GetPlayer(game.currentGameState, removed016.unit.owner).hand.push({ cardId: removed016.unit.cardId });
        game.gameLog.push(`${CardTitle("LOF_016")}: returned ${CardTitle(removed016.unit.cardId)} to its owner's hand.`);
      }
      updateDefeatedPlayers(game.currentGameState);
      const hand016 = GetPlayer(game.currentGameState, pending.player).hand;
      const canPlay016 = hand016.some(c =>
        CardType(c.cardId) === "Unit" && !CardAspects(c.cardId).includes("Villainy") && (CardCost(c.cardId) ?? 0) < returnedCost016);
      if (!canPlay016) return pending.continuation;
      return {
        type: "play-from-hand",
        cardId: "LOF_016_play",
        player: pending.player,
        maxCost: returnedCost016 - 1,
        excludeAspect: "Villainy",
        freePlay: true,
        continuation: pending.continuation,
      } satisfies PlayFromHandPending;
    }
    case "LOF_015": { // Cal Kestis (both sides) — exhaust the chosen (opponent's) ready unit.
      if (targetPlayId) {
        const u015 = GetUnitByPlayId(game.currentGameState, targetPlayId);
        if (u015) {
          u015.ready = false;
          game.gameLog.push(`${CardTitle("LOF_015")}: exhausted ${CardTitle(u015.cardId)}.`);
        }
      }
      return pending.continuation;
    }
    case "LOF_005": { // Morgan Elsbeth (front) — the chosen attacked unit is picked; now play a hand
                      // unit that shares a keyword with it, for 1 resource less.
      if (!targetPlayId || !pending.player) return null;
      const chosen005 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!chosen005) return null;
      return {
        type: "play-from-hand",
        cardId: "LOF_005",
        player: pending.player,
        sharesKeywordWithCardId: chosen005.cardId,
        sharesKeywordWithPlayId: chosen005.playId,
        sharesKeywordWithPlayer: chosen005.controller,
        costReduction: 1,
      } satisfies PlayFromHandPending;
    }
    case "SOR_132": { // Imperial Interceptor WP: Deal 3 damage to chosen space unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 3, game.gameLog);
      break;
    }
    case "ASH_194": { // Snub Fighter Squadron WP: Deal 1 damage to chosen space unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 1, game.gameLog);
      break;
    }
    case "LOF_158": { // Hyena Bomber WP: Deal 2 damage to chosen ground unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
      break;
    }
    case "SHD_235": { // Ruthless Assassin WP: Deal 2 damage to the chosen friendly unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, pending.cardId, targetPlayId, 2, game.gameLog);
      break;
    }
    case "LAW_173": { // BT-1 On Attack: deal 1 damage to the chosen ground unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "LAW_173", targetPlayId, 1, game.gameLog);
      break;
    }
    case "SEC_221": { // Unruly Astromech When Defeated: exhaust the chosen enemy unit.
      if (!targetPlayId) break;
      const target221 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target221) {
        target221.ready = false;
        game.gameLog.push(`${CardTitle("SEC_221")}: exhausted ${CardTitle(target221.cardId)}.`);
      }
      break;
    }
    case "ASH_043_wd": { // Corona Four When Defeated: defeat the chosen non-leader 0-power unit.
      if (!targetPlayId) break;
      const target043wd = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target043wd) break;
      const defeatPend043 = defeatUnit(game.currentGameState, game.gameLog, target043wd);
      game.gameLog.push(`${CardTitle("ASH_043")}: defeated ${CardTitle(target043wd.cardId)}.`);
      if (defeatPend043) return injectContinuation(defeatPend043, pending.continuation);
      return pending.continuation;
    }
    case "SOR_134": { // Ruthless Raider WP/WD: Deal 2 to enemy base + 2 to chosen enemy unit.
      if (!targetPlayId) break;
      // Base damage is applied here (once, at resolution) rather than in resolveWhenPlayed,
      // which is called twice for units; the no-enemy-unit paths handle the base separately.
      if (pending.player) {
        const oppPlayer134: PlayerId = pending.player === 1 ? 2 : 1;
        const oppBase134 = pending.player === 1 ? game.currentGameState.player2 : game.currentGameState.player1;
        oppBase134.base.damage += CapBaseDamage(oppPlayer134, 2);
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
    case "JTL_033": { // Onyx Squadron Brute When Defeated: heal 2 from the chosen base ("a base" — either one).
      const owner033 = pending.player!;
      let basePlayer033: PlayerId | null = null;
      if (targetPlayId === "player1.base") basePlayer033 = 1;
      else if (targetPlayId === "player2.base") basePlayer033 = 2;
      else if (targetIsBase) basePlayer033 = targetBasePlayer ?? owner033;
      if (basePlayer033 === null) break;
      HealBaseForPlayer(game.currentGameState, basePlayer033, 2, game.gameLog, "JTL_033");
      break;
    }
    case "JTL_039": { // Chimaera When Played: use the chosen friendly unit's When Defeated ability.
                      // The unit stays in play — only its ability is used.
      if (!targetPlayId) break;
      const target039 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target039) break;
      game.gameLog.push(`${CardTitle("JTL_039")}: using ${CardTitle(target039.cardId)}'s When Defeated ability.`);
      // Thrawn (JTL_002) triggers on *using* a When Defeated ability, not on the unit dying —
      // so this goes through the Thrawn-aware resolver, same as a real defeat would.
      const used039 = resolveWhenDefeatedWithThrawn(game.currentGameState, target039, pending.player!);
      if (used039) return injectContinuation(used039, pending.continuation);
      break;
    }
    case "JTL_060": { // Desperate Commando When Defeated: –1/–1 for this phase to the chosen unit.
      if (!targetPlayId) break;
      const target060 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target060) GiveStatModForPhase("JTL_060", target060, -1, game.gameLog);
      break;
    }
    case "LOF_031": { // Karis When Defeated: the Force is already spent — give –2/–2 for this phase.
      if (!targetPlayId) break;
      const target031 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target031) GiveStatModForPhase("LOF_031", target031, -2, game.gameLog);
      break;
    }
    case "LAW_010": { // Leia Organa — +1/+1 for each different aspect the chosen unit has.
      if (!targetPlayId) break;
      const target010 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target010) {
        const aspects010 = DistinctAspectCount(target010.cardId);
        if (aspects010 > 0) GiveStatModForPhase("LAW_010", target010, aspects010, game.gameLog);
      }
      break;
    }
    case "SEC_004_xp": { // Leia Organa — give an Experience token to the chosen non-sharing unit.
      if (!targetPlayId) break;
      const target004 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target004) {
        target004.upgrades.push({
          cardId: "SOR_T01",
          playId: nextPlayId(game.currentGameState),
          owner: target004.owner,
          controller: target004.controller,
        });
        game.gameLog.push(`${CardTitle("SEC_004")}: gave an Experience token to ${CardTitle(target004.cardId)}.`);
      }
      break;
    }
    case "LAW_010_deployed": { // Leia Organa (When Deployed) — give the chosen unit an Experience
                                // token for each different aspect among units you control.
      if (!targetPlayId) break;
      const target010d = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target010d) {
        const count010 = DistinctAspectsAmongUnits(pending.player!).size;
        for (let i = 0; i < count010; i++) {
          target010d.upgrades.push({
            cardId: "SOR_T01",
            playId: nextPlayId(game.currentGameState),
            owner: target010d.owner,
            controller: target010d.controller,
          });
        }
        game.gameLog.push(`${CardTitle("LAW_010")}: gave ${count010} Experience token(s) to ${CardTitle(target010d.cardId)}.`);
      }
      break;
    }
    case "LOF_002": { // Mother Talzin (both sides) — give the chosen unit -1/-1 for this phase.
      if (!targetPlayId) break;
      const target002 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target002) GiveStatModForPhase("LOF_002", target002, -1, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "LOF_070_heroism": // Anakin (Champion of Mortis) — either When Played gives –3/–3 for this phase.
    case "LOF_070_villainy": {
      if (!targetPlayId) break;
      const target070 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (target070) GiveStatModForPhase("LOF_070", target070, -3, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
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
        game.currentGameState.player1.base.damage += CapBaseDamage(1, 2);
        game.gameLog.push(`${CardTitle("SOR_158")}: dealt 2 damage to Player 1's base.`);
      } else if (targetPlayId === "player2.base") {
        game.currentGameState.player2.base.damage += CapBaseDamage(2, 2);
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
    case "SOR_025": { // Tarkintown Epic Action: deal 3 damage to a damaged non-leader unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_025", targetPlayId, 3, game.gameLog);
      return sweepDeadUnits(game.currentGameState, game.gameLog, pending.continuation);
    }
    case "SOR_028": { // Jedha City Epic Action: give a non-leader unit -4/-0 for this phase.
      if (!targetPlayId) break;
      const target028 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!target028) break;
      game.currentGameState.currentEffects.push({
        cardId: "SOR_028",
        duration: "Phase",
        affectedPlayer: target028.controller,
        targetPlayId,
      });
      game.gameLog.push(`${CardTitle("SOR_028")}: ${CardTitle(target028.cardId)} gets -4/-0 for this phase.`);
      break;
    }
    case "SOR_136": { // Vader's Lightsaber When Played: deal 4 damage to a ground unit.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "SOR_136", targetPlayId, 4, game.gameLog);
      break;
    }
    case "LOF_091": { // Craving Power When Played: deal damage to an enemy unit equal to attached unit's power.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "LOF_091", targetPlayId, pending.amount ?? 0, game.gameLog);
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
    case "JTL_156": { // Trench Run: +4/+0 ForAttack (and the granted On Attack, see on-attack.ts),
                      // then attack with the chosen Fighter.
      if (!targetPlayId) break;
      game.currentGameState.currentEffects.push({ cardId: "JTL_156", duration: "ForAttack", affectedPlayer: pending.player!, targetPlayId });
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "JTL_156",
        continuation: null,
      };
    }
    case "JTL_177": { // Stay on Target: +2/+0 ForAttack, then attack with the chosen Vehicle.
      if (!targetPlayId) break;
      game.currentGameState.currentEffects.push({ cardId: "JTL_177", duration: "ForAttack", affectedPlayer: pending.player!, targetPlayId });
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "JTL_177",
        continuation: null,
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
    case "LOF_014": { // Grand Inquisitor leader Action: the chosen friendly unit attacks; the
                      // defender gets -2/-0 for this attack.
      if (!targetPlayId) break;
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "LOF_014",
        continuation: null,
      };
    }
    case "TWI_011": { // Ahsoka Tano leader Action: the chosen unit attacks with +1/+0 for this attack.
      if (!targetPlayId) break;
      game.currentGameState.currentEffects.push({
        cardId: "TWI_011_action",
        duration: "ForAttack",
        affectedPlayer: pending.player!,
        targetPlayId,
      });
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "TWI_011",
        continuation: null,
      };
    }
    case "TWI_014_leader": { // Asajj Ventress leader Action: the chosen unit attacks; if an event was
                            // played this phase, it gets +1/+0 for this attack.
      if (!targetPlayId) break;
      if (CardWasPlayedThisPhase(pending.player!, undefined, "Event")) {
        game.currentGameState.currentEffects.push({ cardId: "TWI_014", duration: "ForAttack", affectedPlayer: pending.player!, targetPlayId });
        game.gameLog.push(`${CardTitle("TWI_014")}: chosen unit gets +1/+0 for this attack (event played this phase).`);
      }
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "TWI_014",
        continuation: null,
      };
    }
    case "ASH_004_leader": { // Grand Admiral Thrawn leader Action: the chosen unit attacks; if you
                             // control the same number of units as the defending player, it gains
                             // Restore 2 for this attack.
      if (!targetPlayId) break;
      const opponent004: PlayerId = pending.player! === 1 ? 2 : 1;
      if (GetUnitsForPlayer(pending.player!).length === GetUnitsForPlayer(opponent004).length) {
        game.currentGameState.currentEffects.push({ cardId: "ASH_004_restore", duration: "ForAttack", affectedPlayer: pending.player!, targetPlayId });
        game.gameLog.push(`${CardTitle("ASH_004")}: chosen unit gains Restore 2 for this attack (equal unit count).`);
      }
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "ASH_004",
        continuation: null,
      };
    }
    case "SOR_012_leader": { // IG-88 leader Action: the chosen unit attacks; if you control more
                             // units than the defending player (the opponent), it gets +1/+0.
      if (!targetPlayId) break;
      const opponent012: PlayerId = pending.player! === 1 ? 2 : 1;
      if (GetUnitsForPlayer(pending.player!).length > GetUnitsForPlayer(opponent012).length) {
        game.currentGameState.currentEffects.push({ cardId: "SOR_012_action", duration: "ForAttack", affectedPlayer: pending.player!, targetPlayId });
        game.gameLog.push(`${CardTitle("SOR_012")}: chosen unit gets +1/+0 for this attack (you control more units).`);
      }
      return {
        type: "attack-target",
        attackerPlayId: targetPlayId,
        source: "SOR_012",
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
    case "JTL_018_leader": { // Kazuda Xiono leader Action: the chosen friendly unit loses all abilities this round.
      if (!targetPlayId) break;
      silenceUnitForRound(game.currentGameState, game.gameLog, targetPlayId);
      return pending.continuation ?? null;
    }
    // LAW_013 Chewbacca — shared by the leader Action and the deployed On Attack: defeating a
    // friendly resource is the cost, then deal 2 damage to a unit and create a Credit token.
    case "LAW_013_resource": { // step 1: defeat the chosen friendly resource (the cost)
      if (!targetPlayId) break;
      const player013 = pending.player!;
      if (!DefeatResource(game.currentGameState, player013, targetPlayId, game.gameLog, "LAW_013")) break;
      const allUnits013 = [
        ...game.currentGameState.player1.groundArena, ...game.currentGameState.player1.spaceArena,
        ...game.currentGameState.player2.groundArena, ...game.currentGameState.player2.spaceArena,
      ];
      if (allUnits013.length === 0) {
        // No unit to damage — the Credit token still happens.
        CreateCreditToken(game.currentGameState, player013, game.gameLog, "LAW_013");
        return pending.continuation ?? null;
      }
      return {
        type: "ability-target",
        cardId: "LAW_013_damage",
        player: player013,
        fromPlayIds: allUnits013.map(u => u.playId),
        continuation: pending.continuation,
      } satisfies AbilityTargetPending;
    }
    case "LAW_013_damage": { // step 2: deal 2 damage to the chosen unit and create a Credit token.
      if (!targetPlayId) break;
      DealDamageToUnit(game.currentGameState, "LAW_013", targetPlayId, 2, game.gameLog);
      CreateCreditToken(game.currentGameState, pending.player!, game.gameLog, "LAW_013");
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
        // SHD_187 and other immune units can't be captured by an opponent's card ability.
        const eligible = enemyArena.filter(u => !CardIsLeader(u.cardId) && !UnitImmuneToEnemyAbilities(u.cardId));
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
      return CaptureUnit(game.currentGameState, game.gameLog, twi128Captor, twi128Target, pending.continuation ?? null);
    }
    case "SEC_193_wd": { // Thrawn When Defeated: "A friendly unit captures an enemy non-leader unit
                          // in the same arena." Step 1 picks the captor, step 2 the victim.
      if (!targetPlayId) break;
      if (!pending.sourcePlayId) {
        const captor193 = GetUnitByPlayId(game.currentGameState, targetPlayId);
        if (!captor193) break;
        const victims193 = CaptureVictimPlayIds(game.currentGameState, captor193);
        if (victims193.length === 0) break;
        return {
          type: "ability-target",
          cardId: "SEC_193_wd",
          player: pending.player,
          sourcePlayId: targetPlayId,
          fromPlayIds: victims193,
          continuation: pending.continuation,
        } satisfies AbilityTargetPending;
      }
      const victim193 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      const wdCaptor193 = GetUnitByPlayId(game.currentGameState, pending.sourcePlayId);
      if (!victim193 || !wdCaptor193) break;
      return CaptureUnit(game.currentGameState, game.gameLog, wdCaptor193, victim193, pending.continuation ?? null);
    }
    case "SEC_193": { // Thrawn When Played: the OPPONENT picked one of their units — Thrawn captures it.
      if (!targetPlayId || !pending.sourcePlayId) break;
      const victim = GetUnitByPlayId(game.currentGameState, targetPlayId);
      const thrawn193 = GetUnitByPlayId(game.currentGameState, pending.sourcePlayId);
      if (!victim || !thrawn193) break;
      return CaptureUnit(game.currentGameState, game.gameLog, thrawn193, victim, pending.continuation ?? null);
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
    case "JTL_100": { // Poe Dameron — attach himself as a Pilot upgrade onto the chosen Vehicle.
      if (!targetPlayId || !pending.sourcePlayId) break;
      const poe100 = GetUnitByPlayId(game.currentGameState, pending.sourcePlayId);
      const vehicle100 = GetUnitByPlayId(game.currentGameState, targetPlayId);
      if (!poe100 || !vehicle100) break;
      removeFromArena(game.currentGameState, poe100.playId);
      for (const upg of poe100.upgrades) {
        game.gameLog.push(`${CardTitle(upg.cardId)} on ${CardTitle("JTL_100")} was defeated.`);
      }
      vehicle100.upgrades.push({
        cardId: "JTL_100",
        playId: nextPlayId(game.currentGameState),
        owner: poe100.owner,
        controller: poe100.controller,
      });
      game.gameLog.push(`${CardTitle("JTL_100")} attached as a Pilot upgrade to ${CardTitle(vehicle100.cardId)}.`);
      updateDefeatedPlayers(game.currentGameState);
      return pending.continuation ?? null;
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
