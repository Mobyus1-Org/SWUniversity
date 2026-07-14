import type { GameState } from "@/lib/engine/game";
import type { PlayerId, Resource } from "@/lib/engine/core-models";
import { CardAspects, CardCost, CardTitle, CardTraits, CardType } from "@/server/engine/card-db/generated";
import { UpgradeEligibleTargets, PilotingEligibleVehicles } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { ExploitAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/exploit";
import { PilotingCost } from "@/server/engine/card-db/keyword-dictionaries.ts/piloting";
import { Unit } from "@/server/engine/unit";
import { TraitContains } from "@/server/engine/core-functions";
import { SmuggleCost, SmuggleAspects } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";

/**
 * Everything the player can put toward a cost: ready resources plus Credit tokens.
 *
 * Credits are not resources (CR 375), but they read "While paying resources, you may
 * defeat this token. If you do, pay 1 less" — so a cost is affordable when ready
 * resources and Credits together cover it. Every affordability guard uses this.
 */
export function spendableFor(game: GameState, player: PlayerId): number {
  const p = player === 1 ? game.player1 : game.player2;
  return p.resources.filter(r => r.ready).length + (p.supplemental.creditTokens ?? 0);
}

/**
 * The aspect penalty for playing `cardId`: +2 per aspect icon the player's base + leader do not
 * cover. This is THE definition — both the playability check and the actual payment path use it.
 */
export function aspectPenalty(game: GameState, player: PlayerId, cardId: string): number {
  const p = player === 1 ? game.player1 : game.player2;

  // Darksaber: free aspect penalty when a friendly non-Vehicle Mandalorian unit is in play
  if (cardId === "SHD_126") {
    const hasMandalorian = [...p.groundArena, ...p.spaceArena].some(
      u => !TraitContains(u.cardId, "Vehicle") && TraitContains(u.cardId, "Mandalorian", player, u.playId),
    );
    if (hasMandalorian) return 0;
  }

  return aspectPenaltyForAspects(game, player, CardAspects(cardId));
}

function delMeekoEventTax(game: GameState, player: PlayerId, cardId: string): number {
  if (CardType(cardId) !== "Event") return 0;
  const oppState = player === 1 ? game.player2 : game.player1;
  const oppUnits = [...oppState.groundArena, ...oppState.spaceArena];
  return oppUnits.some(u => u.cardId === "SOR_034" && !Unit.FromInterface(u).LostAbilities()) ? 1 : 0;
}

// SOR_061 / LOF_058 Guardian of the Whills: first upgrade played on this unit each round costs 1 less.
function guardianOfTheWhillsDiscount(game: GameState, player: PlayerId, cardId: string): number {
  if (CardType(cardId) !== "Upgrade") return 0;
  const p = player === 1 ? game.player1 : game.player2;
  const eligibleTargets = UpgradeEligibleTargets(cardId, game, player);
  const hasEligibleGuardian = [...p.groundArena, ...p.spaceArena].some(u => {
    if (u.cardId !== "SOR_061" && u.cardId !== "LOF_058") return false;
    if (Unit.FromInterface(u).LostAbilities()) return false;
    if (game.currentEffects.some(e => e.cardId === "SOR_061_firstUpgradeUsed" && e.targetPlayId === u.playId && e.affectedPlayer === player)) return false;
    return eligibleTargets.includes(u.playId);
  });
  return hasEligibleGuardian ? 1 : 0;
}

// SOR_181 Jabba the Hutt: each TRICK event costs 1 less.
function jabbaTheTrickDiscount(game: GameState, player: PlayerId, cardId: string): number {
  if (CardType(cardId) !== "Event" || !CardTraits(cardId).includes("Trick")) return 0;
  const p = player === 1 ? game.player1 : game.player2;
  const hasJabba = [...p.groundArena, ...p.spaceArena].some(
    u => u.cardId === "SOR_181" && !Unit.FromInterface(u).LostAbilities(),
  );
  return hasJabba ? 1 : 0;
}

// SOR_139 Force Choke: costs 1 less if you control a Force unit.
function forceChokeDiscount(game: GameState, player: PlayerId, cardId: string): number {
  if (cardId !== "SOR_139") return 0;
  const p = player === 1 ? game.player1 : game.player2;
  const hasForceUnit = [...p.groundArena, ...p.spaceArena].some(
    u => CardTraits(u.cardId).includes("Force") && !Unit.FromInterface(u).LostAbilities(),
  );
  return hasForceUnit ? 1 : 0;
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

/**
 * The full cost to play `cardId` from hand: printed cost + aspect penalty + taxes − discounts.
 * The single definition used by BOTH the playability check (what the UI offers) and the payment
 * path in dispatch-listener (what actually gets charged) — they must never disagree.
 */
export function playCost(game: GameState, player: PlayerId, cardId: string): number {
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

/**
 * The cost to play a Pilot card as an upgrade on a Vehicle: its piloting cost plus the same
 * aspect penalty. Card-cost discounts (Bendu, GNK, …) key off the printed cost and do not apply.
 */
export function pilotPlayCost(game: GameState, player: PlayerId, cardId: string): number {
  return PilotingCost(cardId) + aspectPenalty(game, player, cardId);
}

/** SOR_062 Regional Governor: while in play, opponents can't play the card named on entry. */
export function regionalGovernorBlocks(game: GameState, player: PlayerId, cardId: string): boolean {
  const title = CardTitle(cardId);
  if (!title) return false;
  const opp = player === 1 ? game.player2 : game.player1;
  return [...opp.groundArena, ...opp.spaceArena].some(
    u => u.cardId === "SOR_062" && !Unit.FromInterface(u).LostAbilities() && u.namedCardTitle === title,
  );
}

/**
 * The aspect icons the player's base + leader do NOT cover, as a multiset — a card with two
 * Aggression icons against a single Aggression source leaves one uncovered.
 * The one place aspect matching is defined; everything else counts or filters this list.
 */
export function uncoveredAspects(game: GameState, player: PlayerId, aspects: string[]): string[] {
  const p = player === 1 ? game.player1 : game.player2;
  const provided = [
    ...CardAspects(p.base.cardId),
    ...CardAspects(p.leader.cardId),
  ];
  const counts = new Map<string, number>();
  for (const a of provided) counts.set(a, (counts.get(a) ?? 0) + 1);

  const uncovered: string[] = [];
  for (const a of aspects) {
    const rem = counts.get(a) ?? 0;
    if (rem > 0) counts.set(a, rem - 1);
    else uncovered.push(a);
  }
  return uncovered;
}

function aspectPenaltyForAspects(game: GameState, player: PlayerId, aspects: string[]): number {
  return uncoveredAspects(game, player, aspects).length * 2;
}

function hasTechInPlay(game: GameState, player: PlayerId): boolean {
  const p = player === 1 ? game.player1 : game.player2;
  return [...p.groundArena, ...p.spaceArena].some(
    u => u.cardId === "SHD_248" && !Unit.FromInterface(u).LostAbilities(),
  );
}

export function effectiveSmuggleCost(
  game: GameState,
  player: PlayerId,
  resource: Resource,
): number | null {
  const { cardId } = resource;
  let best: number | null = null;

  const ownBase = SmuggleCost(cardId);
  if (ownBase >= 0) {
    const ownCost = ownBase + aspectPenaltyForAspects(game, player, SmuggleAspects(cardId));
    best = best === null ? ownCost : Math.min(best, ownCost);
  }

  if (hasTechInPlay(game, player)) {
    const techCost = CardCost(cardId) + 2 + aspectPenaltyForAspects(game, player, CardAspects(cardId));
    best = best === null ? techCost : Math.min(best, techCost);
  }

  return best;
}

export function ResourceIsSmuggleable(
  game: GameState,
  player: PlayerId,
  resource: Resource,
): boolean {
  const cost = effectiveSmuggleCost(game, player, resource);
  if (cost === null) return false;
  const p = player === 1 ? game.player1 : game.player2;
  const readyCount = p.resources.filter(r => r.ready).length;
  return readyCount >= cost;
}

// SOR_199 Bamboozle: playable via alternate cost if hand has another Cunning card.
function bamboozleAltCostAvailable(game: GameState, player: PlayerId): boolean {
  const p = player === 1 ? game.player1 : game.player2;
  const allCunningCount = p.hand.filter(c => CardAspects(c.cardId).includes("Cunning")).length;
  // Subtract the Bamboozle card itself being played — need at least one other Cunning card.
  return allCunningCount - 1 > 0;
}

export function CardIsPlayable(game: GameState, player: PlayerId, cardId: string): boolean {
  if (regionalGovernorBlocks(game, player, cardId)) return false;

  const p = player === 1 ? game.player1 : game.player2;
  const readyResources = spendableFor(game, player);
  const fullCost = playCost(game, player, cardId);

  // SOR_199 Bamboozle: can be played via alternate cost (discard a Cunning card from hand).
  if (cardId === "SOR_199" && bamboozleAltCostAvailable(game, player)) return true;
  const exploitAmt = ExploitAmount(cardId, "hand", player, true);
  const numUnits = p.groundArena.length + p.spaceArena.length;
  const minUnitCost = Math.max(0, fullCost - Math.min(exploitAmt, numUnits) * 2);

  // Check if piloting is an option
  const pilotBase = PilotingCost(cardId);
  if (pilotBase >= 0) {
    // Must match the payment path exactly: piloting cost + aspect penalty. (This used to be
    // `fullCost - CardCost`, which wrongly folded card-cost discounts and taxes into it.)
    const pilotFullCost = pilotPlayCost(game, player, cardId);
    const canAffordPilot = readyResources >= pilotFullCost;
    const hasVehicle = PilotingEligibleVehicles(game, player).length > 0;
    if (canAffordPilot && hasVehicle) return true;
  }

  if (readyResources < minUnitCost) return false;

  if (CardType(cardId) === "Upgrade") {
    return UpgradeEligibleTargets(cardId, game, player).length > 0;
  }

  return true;
}
