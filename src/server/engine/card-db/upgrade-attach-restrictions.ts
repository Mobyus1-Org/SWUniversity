import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import { CardIsLeader, TraitContains } from "../core-functions";
import { PilotingCost } from "@/server/engine/card-db/keyword-dictionaries.ts/piloting";
import { LeaderDeployPilotThreshold } from "./keyword-dictionaries.ts/leader-pilot-deploy";

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
    // "Attach to a non-Vehicle unit."
    case "SOR_053": //Luke's Lightsaber
    case "SOR_054": //Jedi Lightsaber
    case "SOR_071": //Electrostaff
    case "SOR_136": //Vader's Lightsaber
    case "SOR_137": //Fallen Lightsaber
    case "SHD_073": //Mandalorian Armor
    case "SHD_074": //Vambrace Grappleshot
    case "SHD_104": //Inspiring Mentor
    case "SHD_126": //The Darksaber
    case "SHD_174": //Hotshot DL-44 Blaster
    case "SHD_177": //Vambrace Flamethrower
    case "SHD_224": //Boba Fett's Armor
    case "SHD_225": //Jetpack
    case "TWI_121": //General's Blade
    case "TWI_152": //Mace Windu's Lightsaber
    case "TWI_236": //Grievous's Wheel Bike
    case "TWI_248": //Ahsoka's Padawan Lightsaber
    case "TWI_256": //Hold-Out Blaster
    case "LOF_040": //Kylo Ren's Lightsaber
    case "LOF_053": //Heirloom Lightsaber
    case "LOF_090": //Inquisitor's Lightsaber
    case "LOF_102": //Yoda's Lightsaber
    case "LOF_122": //Pillio Star Compass
    case "LOF_171": //Heavy Blaster Cannon
    case "LOF_187": //Corrupted Saber
    case "LOF_215": //Ascension Cable
    case "LOF_238": //Darth Revan's Lightsabers
    case "SEC_156": //Nemik's Manifesto
    case "LAW_111": //Leia's Disguise
    case "LAW_126": //Adventurer Sniper Rifle
    case "LAW_150": //Fulcrum
    case "LAW_186": //Enfys Nest's Helmet
    case "LAW_201": //Thermal Detonator
    case "TS26_022": //The Darksaber
    case "TS26_035": //Ahsoka's Lightsabers
    case "TS26_052": //Sith Traditions
    case "TS26_063": //Rex's DC-17s
    case "TS26_055": //Blade of Talzin
    case "ASH_066": //Luke's Jedi Lightsaber
    case "ASH_183": //Whistling Birds
      return everyone.filter(u => !TraitContains(u.cardId, "Vehicle")).map(u => u.playId);

    // "Attach to a Jedi non-Vehicle unit."
    case "LOF_151": //Knight's Saber
      return everyone.filter(u => TraitContains(u.cardId, "Jedi") && !TraitContains(u.cardId, "Vehicle")).map(u => u.playId);

    // "Attach to a friendly non-Vehicle unit."
    case "SHD_251": //The Mandalorian's Rifle
    case "LOF_140": //Darth Maul's Lightsaber
    case "LOF_201": //Qui-Gon Jinn's Lightsaber
      return friendly.filter(u => !TraitContains(u.cardId, "Vehicle")).map(u => u.playId);

    // "Attach to a friendly unit."
    case "SHD_124": // Legal Authority
      return friendly.map(u => u.playId);

    // "Attach to a Force unit."
    case "LOF_074": //Bolstered Endurance
    case "LOF_261": //Constructed Lightsaber
      return everyone.filter(u => TraitContains(u.cardId, "Force")).map(u => u.playId);

    default:
      return everyone.map(u => u.playId);
  }
}

const maxPilotsByCardId: Record<string, number> = {
  "JTL_249": 2, //Millennium Falcon - Get Out And Push
};


function effectiveMaxPilots(unit: { cardId: string; upgrades: Array<{ cardId: string }> }): number {
  const base = maxPilotsByCardId[unit.cardId] ?? 1;
  const r2d2Aboard = unit.upgrades.some(upg => upg.cardId === "JTL_245"); //R2-D2 - Artooooooooo!
  return r2d2Aboard ? base + 1 : base;
}

/**
 * Returns playIds of friendly Vehicle units that have not yet reached their PILOT upgrade limit.
 * A PILOT upgrade is any attached card with PilotingCost >= 0, or a leader with a deploy-as-pilot threshold.
 * Non-pilot leader upgrades (e.g. Poe Dameron attached via leader ability) are ignored.
 * R2-D2 already aboard raises the effective max by 1.
 */
export function PilotingEligibleVehicles(game: GameState, player: PlayerId): string[] {
  const p = player === 1 ? game.player1 : game.player2;
  const friendly = [...p.groundArena, ...p.spaceArena];
  return friendly
    .filter(u => {
      if (!TraitContains(u.cardId, "Vehicle")) return false;
      const pilotCount = u.upgrades.filter(upg => PilotingCost(upg.cardId) >= 0
        || (CardIsLeader(upg.cardId) && LeaderDeployPilotThreshold(upg.cardId) !== null)).length;
      return pilotCount < effectiveMaxPilots(u);
    })
    .map(u => u.playId);
}
