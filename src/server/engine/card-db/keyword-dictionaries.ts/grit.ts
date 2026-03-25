import { GetCurrentEffectsForPlayer, GetPlayIdForUniqueUnitInPlay, GetUnitInPlay, GetUnitsForPlayer, HasTheForce, IsCoordinateActive, TraitContains } from "../../core-functions";
import { PlayerId } from "../../core-models";

export function HasGrit(cardId: string, playId?: string, player?: PlayerId, isRecursion = false)
{
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasGrit");
    if (unit.LostAbilities()) return false;
    if (!unit.IsLeader()) {
      const units = GetUnitsForPlayer(player);
      for (const u of units) {
        switch (u.cardId) {
          case "SEC_088"://First Light - Headquarters of the Crimson Dawn
            return true;
          default:
            break;
        }
      }
    }
    const upgrades = unit.upgrades;
    for(const u of upgrades) {
      switch(u.cardId) {
        case "JTL_001"://Asajj - I Work Alone
        case "JTL_034"://Interceptor Ace
        case "JTL_050"://Phantom II
          return true;
        case "JTL_150"://Biggs Darklighter
          if(TraitContains(cardId, "Speeder", player)) return true;
          break;
        case "LOF_238"://Darth Revan's Lightsabers (yes there are two of them in one card)
          if(TraitContains(cardId, "Sith", player)) return true;
          break;
        default: break;
      }
    }

    for(const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if(currentEffect.cardId ===  "JTL_047_Grit" && TraitContains(cardId, "Vehicle", player)) return true;//Admiral Yularen - Fleet Coordinator
      if(currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) continue;
      switch(currentEffect.cardId) {
        case "TWI_172": return true;//Grim Resolve
        default: break;
      }
    }
    const units = GetUnitsForPlayer(player);
    switch(cardId) {
      //conditional grit
      case "TWI_050"://Luminara Unduli
        return IsCoordinateActive(player);
      case "LOF_050"://Plo Koon
        return HasTheForce(player);
      case "LOF_105": //Oppo Rancisis
        if (isRecursion) return false; //Prevent recursion
        for(const unit of units) {
          if(unit.playId === playId) continue;
          if(HasGrit(unit.cardId, unit.playId, player, true)) return true;
        }
        break;
      default: break;
    }
  }

  switch(cardId)
  {
    case "SOR_148"://Guerilla Attack Pod
    case "SOR_032"://Scout Bike Pursuer
    case "SOR_165"://Occupier Siege Tank
    case "SOR_065"://Baze Malbus (Temple Guardian)
    case "SOR_067"://Rugged Survivors
    case "SOR_003"://Chewbacca (Walking Carpet)
    case "SHD_136"://Death Watch Loyalist
    case "SHD_027"://Hylobon Enforcer
    case "SHD_048"://Gentle Giant
    case "SHD_171"://Covetous Rivals
    case "SHD_061"://Wroshyr Tree Tender
    case "SEC_225"://Synara San
    case "SEC_088"://First Light
    case "SHD_002"://Qi'Ra Leader Unit
    case "SHD_249"://Wookiee Warrior
    case "SHD_146"://Heroic Renegade
    case "SHD_050"://Chewbacca Pykesbane
    case "TWI_044"://Kashyyyk Defender
    case "TWI_231"://Dwarf Spider Droid
    case "TWI_036"://Devastating Gunship
    case "JTL_001"://Asajj Leader Unit
    case "JTL_061"://Royal Security Fighter
    case "JTL_034"://Interceptor Ace
    case "JTL_050"://Phantom II
    case "JTL_167"://Occupier Siege Tank
    case "LOF_038"://Pong Krell
    case "LOF_232"://Sandtrooper Cavalry
    case "SEC_057"://Lobot
    default: break;
  }
  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId
        && HasGrit("JTL_053", theGhostPlayId, player))
      return true;
  }

  return false;
}