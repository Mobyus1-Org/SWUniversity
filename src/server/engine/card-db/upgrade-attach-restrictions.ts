import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import { CardTraits } from "@/server/engine/card-db/generated";

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
    case "LOF_074": // Bolstered Endurance — Attach to a Force unit.
      return all.filter(u => CardTraits(u.cardId).includes("Force")).map(u => u.playId);
    default:
      return all.map(u => u.playId);
  }
}
