import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import { TraitContains } from "../core-functions";

function ownUnits(game: GameState, player: PlayerId) {
  const p = player === 1 ? game.player1 : game.player2;
  return [...p.groundArena, ...p.spaceArena];
}

function allUnits(game: GameState) {
  return [
    ...game.player1.groundArena, ...game.player1.spaceArena,
    ...game.player2.groundArena, ...game.player2.spaceArena,
  ];
}

/**
 * Returns the playIds of units eligible to receive the given upgrade.
 * Default: any unit on the board (no restriction).
 * Cards with attach restrictions get their own case.
 */
export function UpgradeEligibleTargets(
  upgradeCardId: string,
  game: GameState,
  player: PlayerId,
): string[] {
  const friendly = ownUnits(game, player);
  const everyone = allUnits(game);

  switch (upgradeCardId) {
    // "Attach to a friendly unit."
    case "SHD_124": // Legal Authority
      return friendly.map(u => u.playId);

    // "Attach to a Force unit."
    case "LOF_074": // Bolstered Endurance
    case "LOF_261": // Constructed Lightsaber
      return everyone.filter(u => TraitContains(u.cardId, "Force")).map(u => u.playId);

    default:
      return everyone.map(u => u.playId);
  }
}
