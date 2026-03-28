import { GetUnitInPlay } from "@/server/engine/core-functions";
import { PlayerId } from "@/lib/engine/core-models";

export function HasCoordinate(cardId: string, playId?: string, player?: PlayerId)
{
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasCoordinate");
    if (unit.LostAbilities()) return false;
    const upgrades = unit.upgrades;
    for (const u of upgrades) {
      if(u.cardId === "TWI_051") return true;//For the republic
    }
  }

  switch (cardId) {
    case "TWI_008"://Padme Amidala - Serving The Republic
    case "TWI_011"://Ahsoka Tano
    case "TWI_012"://Anakin Skywalker
    case "TWI_045"://41st Elite Corps
    case "TWI_050"://Luminara Unduli
    case "TWI_061"://Infantry of the 212th
    case "TWI_064"://Ki-Adi-Mundi
    case "TWI_090"://Echo
    case "TWI_095"://Pelta Supply Frigate
    case "TWI_096"://Aayla Secura
    case "TWI_106"://Coruscant Guard
    case "TWI_114"://Clone Commander Cody
    case "TWI_158"://Clone Heavy Gunner
    case "TWI_162"://Reckless Torrent
    case "TWI_164"://Hevy
    case "TWI_165"://Kit Fisto
    case "TWI_192"://Padme Amidala - Pursuing Peace
    case "TWI_196"://Plo Koon
    case "TWI_205"://Clone Dive Trooper
    case "TWI_213"://Sanctioner's Shuttle
    case "TWI_240"://332nd Stalwart
    case "TWI_243"://Republic Commando
      return true;
    default: return false;
  }
}