import { GetGame, TraitContains } from "./core-functions";
import { Unit } from "./unit";

/**
 * Give an Experience token to each other friendly Mandalorian unit (Darksaber On Attack).
 * Safe to call when game singleton may not be set — returns silently if no game.
 */
export function applyDarksaberOnAttack(attacker: Unit): void {
  const game = GetGame();
  if (!game) return;
  const gs = game.currentGameState;
  const player = attacker.controller;
  const friendly = player === 1
    ? [...gs.player1.groundArena, ...gs.player1.spaceArena]
    : [...gs.player2.groundArena, ...gs.player2.spaceArena];
  for (const unit of friendly) {
    if (unit.playId === attacker.playId) continue;
    if (TraitContains(unit.cardId, "Mandalorian", player, unit.playId)) {
      unit.upgrades.push({
        cardId: "SOR_T01",
        playId: String(gs.nextPlayId++),
        owner: player,
        controller: player,
      });
    }
  }
}