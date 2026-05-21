import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import { TraitContains } from "../core-functions";
import { PilotingCost } from "@/server/engine/card-db/keyword-dictionaries.ts/piloting";

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

const maxPilotsByCardId: Record<string, number> = {
  "JTL_249": 2, // Millennium Falcon
};

const R2D2_CARD_ID = "JTL_245";

function effectiveMaxPilots(unit: { cardId: string; upgrades: Array<{ cardId: string }> }): number {
  const base = maxPilotsByCardId[unit.cardId] ?? 1;
  const r2d2Aboard = unit.upgrades.some(upg => upg.cardId === R2D2_CARD_ID);
  return r2d2Aboard ? base + 1 : base;
}

/**
 * Returns playIds of friendly Vehicle units that have not yet reached their PILOT upgrade limit.
 * A PILOT upgrade is any attached card with PilotingCost >= 0.
 * Non-pilot upgrades (e.g. Poe Dameron attached via leader ability, PilotingCost = -1) are ignored.
 * R2-D2 already aboard raises the effective max by 1.
 */
export function PilotingEligibleVehicles(game: GameState, player: PlayerId): string[] {
  const p = player === 1 ? game.player1 : game.player2;
  const friendly = [...p.groundArena, ...p.spaceArena];
  return friendly
    .filter(u => {
      if (!TraitContains(u.cardId, "Vehicle")) return false;
      const pilotCount = u.upgrades.filter(upg => PilotingCost(upg.cardId) >= 0).length;
      return pilotCount < effectiveMaxPilots(u);
    })
    .map(u => u.playId);
}
