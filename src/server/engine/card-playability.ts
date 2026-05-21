import type { GameState } from "@/lib/engine/game";
import type { PlayerId, Resource } from "@/lib/engine/core-models";
import { CardAspects, CardCost, CardType } from "@/server/engine/card-db/generated";
import { UpgradeEligibleTargets, PilotingEligibleVehicles } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { ExploitAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/exploit";
import { PilotingCost } from "@/server/engine/card-db/keyword-dictionaries.ts/piloting";
import { Unit } from "@/server/engine/unit";
import { SmuggleCost, SmuggleAspects } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";

function playCost(game: GameState, player: PlayerId, cardId: string): number {
  const p = player === 1 ? game.player1 : game.player2;
  const provided = [...CardAspects(p.base.cardId), ...CardAspects(p.leader.cardId)];
  const counts = new Map<string, number>();
  for (const a of provided) counts.set(a, (counts.get(a) ?? 0) + 1);
  let missing = 0;
  for (const a of CardAspects(cardId)) {
    const rem = counts.get(a) ?? 0;
    if (rem > 0) counts.set(a, rem - 1);
    else missing++;
  }
  return CardCost(cardId) + missing * 2;
}

function aspectPenaltyForAspects(game: GameState, player: PlayerId, aspects: string[]): number {
  const p = player === 1 ? game.player1 : game.player2;
  const provided = [
    ...CardAspects(p.base.cardId),
    ...CardAspects(p.leader.cardId),
  ];
  const counts = new Map<string, number>();
  for (const a of provided) counts.set(a, (counts.get(a) ?? 0) + 1);
  let missing = 0;
  for (const a of aspects) {
    const rem = counts.get(a) ?? 0;
    if (rem > 0) counts.set(a, rem - 1);
    else missing++;
  }
  return missing * 2;
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

export function CardIsPlayable(game: GameState, player: PlayerId, cardId: string): boolean {
  const p = player === 1 ? game.player1 : game.player2;
  const readyResources = p.resources.filter(r => r.ready).length;
  const fullCost = playCost(game, player, cardId);
  const exploitAmt = ExploitAmount(cardId, "hand", player, true);
  const numUnits = p.groundArena.length + p.spaceArena.length;
  const minUnitCost = Math.max(0, fullCost - Math.min(exploitAmt, numUnits) * 2);

  // Check if piloting is an option
  const pilotBase = PilotingCost(cardId);
  if (pilotBase >= 0) {
    const aspectPen = fullCost - CardCost(cardId); // the aspect penalty already computed
    const pilotFullCost = pilotBase + aspectPen;
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
