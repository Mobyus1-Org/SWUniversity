import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import { CardIsLeader, TraitContains } from "../core-functions";
import { CardCost, CardType } from "@/server/engine/card-db/generated";
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

    // "Attach to a VEHICLE unit."
    case "SOR_121": //Hardpoint Heavy Blaster
    case "SOR_214": //Smuggling Compartment
      return everyone.filter(u => TraitContains(u.cardId, "Vehicle")).map(u => u.playId);

    // "Attach to a friendly non-Vehicle unit."
    case "SHD_251": //The Mandalorian's Rifle
    case "LOF_140": //Darth Maul's Lightsaber
    case "LOF_201": //Qui-Gon Jinn's Lightsaber
      return friendly.filter(u => !TraitContains(u.cardId, "Vehicle")).map(u => u.playId);

    // "Attach to a friendly unit."
    case "SHD_124": // Legal Authority
    case "LOF_091": // Craving Power
      return friendly.map(u => u.playId);

    // "Attach to a non-leader unit that costs 3 or less (and has no leader pilot)."
    // When attached: take control. Not eligible on units that have a leader as upgrade
    // because those become "Leader units."
    case "SOR_122": // Traitorous
      return everyone.filter(u => {
        if (CardIsLeader(u.cardId)) return false;
        if (CardCost(u.cardId) > 3) return false;
        if (u.upgrades.some(upg => CardIsLeader(upg.cardId))) return false;
        return true;
      }).map(u => u.playId);

    // "Attach to a Force unit."
    case "LOF_074": //Bolstered Endurance
    case "LOF_261": //Constructed Lightsaber
      return everyone.filter(u => TraitContains(u.cardId, "Force")).map(u => u.playId);

    default:
      return everyone.map(u => u.playId);
  }
}

/**
 * True if the given upgrade card is a Pilot upgrade. This is the SINGLE definition of "a Pilot
 * is on this unit" — every pilot-slot rule below reads it, so the three ways a Pilot can end up
 * attached all count:
 *   - a Pilot unit played via the Piloting keyword (has a piloting cost),
 *   - a Pilot leader deployed as an upgrade (Luke JTL_012, Asajj JTL_001, Kazuda JTL_018),
 *   - a Pilot leader ATTACHED by his own ability (Poe JTL_013) — he has neither a piloting cost
 *     nor a deploy threshold, so he is only recognisable by his Pilot trait. Missing him used to
 *     make a Vehicle carrying him read as pilotless.
 */
export function IsPilotUpgrade(cardId: string): boolean {
  return PilotingCost(cardId) >= 0
    || (CardIsLeader(cardId) && LeaderDeployPilotThreshold(cardId) !== null)
    || (CardIsLeader(cardId) && TraitContains(cardId, "Pilot"));
}

/** How many Pilots are currently attached to a unit. */
function pilotCountOn(unit: { upgrades: Array<{ cardId: string }> }): number {
  return unit.upgrades.filter(upg => IsPilotUpgrade(upg.cardId)).length;
}

/**
 * A token upgrade is a token card (generator gives tokens a `_T##` id) that is an Upgrade —
 * e.g. Experience (SOR_T01) and Shield (SOR_T02) tokens.
 */
export function IsTokenUpgrade(cardId: string): boolean {
  return /_T\d+$/.test(cardId) && CardType(cardId) === "Upgrade";
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
 * Friendly Vehicles with NO Pilot on them at all — the "...to a friendly Vehicle unit without a
 * Pilot on it" predicate used by ATTACH effects: Poe Dameron leader (JTL_013), Poe Dameron unit
 * (JTL_100) and L3-37 (JTL_049).
 *
 * Deliberately strict: the extra slots granted by the Millennium Falcon ("You may play or deploy
 * 1 additional Pilot on this unit") and by R2-D2 permit an additional PLAY or DEPLOY only. An
 * attach is neither, so a Falcon that already carries one Pilot still has a free slot yet is NOT
 * a legal attach target.
 */
export function PilotlessVehiclePlayIds(game: GameState, player: PlayerId, excludePlayId?: string): string[] {
  const p = player === 1 ? game.player1 : game.player2;
  const friendly = [...p.groundArena, ...p.spaceArena];
  return friendly
    .filter(u => {
      if (u.playId === excludePlayId) return false;
      if (!TraitContains(u.cardId, "Vehicle")) return false;
      return pilotCountOn(u) === 0;
    })
    .map(u => u.playId);
}

export function PilotingEligibleVehicles(
  game: GameState,
  player: PlayerId,
  /** The pilot about to be attached. R2-D2 brings his own slot, so he may board a full Vehicle. */
  incomingPilotCardId?: string,
): string[] {
  const p = player === 1 ? game.player1 : game.player2;
  const friendly = [...p.groundArena, ...p.spaceArena];
  return friendly
    .filter(u => {
      if (!TraitContains(u.cardId, "Vehicle")) return false;
      // R2-D2 (JTL_245): "This upgrade can be played on a friendly Vehicle unit with a Pilot on
      // it." He grants the extra slot he occupies, so his own arrival must not be blocked by a
      // Vehicle already being at its pilot limit.
      const incomingR2 = incomingPilotCardId === "JTL_245"
        && !u.upgrades.some(upg => upg.cardId === "JTL_245");
      return pilotCountOn(u) < effectiveMaxPilots(u) + (incomingR2 ? 1 : 0);
    })
    .map(u => u.playId);
}
