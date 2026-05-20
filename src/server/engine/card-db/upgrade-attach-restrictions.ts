import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import { TraitContains } from "../core-functions";

function ownUnits(game: GameState, player: PlayerId) {
  const p = player === 1 ? game.player1 : game.player2;
  return [...p.groundArena, ...p.spaceArena];
}

/**
 * Returns the playIds of units eligible to receive the given upgrade.
 * Each card with an "Attach to a <condition> unit." restriction gets its own case.
 */
export function UpgradeEligibleTargets(
  upgradeCardId: string,
  game: GameState,
  player: PlayerId,
): string[] {
  const all = ownUnits(game, player);

  switch (upgradeCardId) {
    case "LOF_074": // Bolstered Endurance
    case "LOF_261": // Constructed Lightsaber
      return all.filter(u => TraitContains(u.cardId, "Force")).map(u => u.playId);
    default:
      return all.map(u => u.playId);
  }
}
