import { GetCurrentEffectsForPlayer, GetPlayIdForUniqueUnitInPlay, GetUnitInPlay, GetUnitsForPlayer, HasTheForce, IsCoordinateActive, PlayerHasUnitWithAspectInPlay, PlayerHasUnitWithTraitInPlay, TraitContains } from "@/server/engine/core-functions";
import { PlayerId, Zones } from "@/lib/engine/core-models";
import { CardCost, CardTitle, CardType } from "@/server/engine/card-db/generated";

export function HasAmbush(cardId: string, playId?: string, playedFrom?: Zones, player?: PlayerId, isRecursion = false)
{
  if (cardId == "TWI_116") return false; //Clone - Prevent bugs related to ECL and Timely.

  if (player && playId) {
    const otherPlayer = player == 1 ? 2 : 1;
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasAmbush");
    if(unit.LostAbilities()) return false;

    for (const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if (currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) continue;
      switch(currentEffect.cardId) {
        case "SOR_022"://Energy Conversion Lab (ECL
        case "SHD_129"://Timely Intervention
        case "SHD_220"://Fennec Shand
        case "SHD_016"://Fennec Shand Leader Unit
        case "LOF_220"://Shien Flurry
        case "LOF_180"://Deceptive Shade
          return true;
        default: break;
      }
    }

    const units = GetUnitsForPlayer(player);
    for(const u of units){
      switch(u.cardId) {
        case "SOR_079"://Admiral Piett
          if(CardCost(cardId) >= 6 && CardType(cardId) === "Unit") return true;
          break;
        case "SOR_100"://Wedge Antilles
          if(TraitContains(cardId, "Vehicle", player)) return true;
          break;
        case "SHD_188"://4-LOM
          if(CardTitle(cardId) === "Zuckuss") return true;
          break;
        default: break;
      }
    }

    switch (cardId) {
      //conditional ambush
      case "SOR_114"://Escort Skiff
        return PlayerHasUnitWithAspectInPlay(player, "Cunning", true, playId);
      case "SOR_249"://Frontier AT-RT
        return PlayerHasUnitWithTraitInPlay(player, "Vehicle", true, playId);
      case "JTL_249"://Millennium Falcon
        return playedFrom === "Hand";
      case "TWI_106"://Coruscant Guard
        return IsCoordinateActive(player);
      case "TWI_081"://Droid Commando
        return PlayerHasUnitWithTraitInPlay(player, "Separatist", true, playId);
      case "TWI_117"://Baktoid Spider Droid
        return true;
      case "TWI_194"://Ahsoka Tano
        return units.length < GetUnitsForPlayer(otherPlayer).length;
      case "LOF_118"://Terentatek
        return PlayerHasUnitWithTraitInPlay(otherPlayer, "Force");
      case "LOF_231"://Darth Tyranus
        return HasTheForce(player);
      case "LOF_105"://Oppo Rancisis
        if(isRecursion) return false; //Prevent recursion
        for(const u of units) {
          if(u.playId === playId) continue;
          if(HasAmbush(u.cardId, u.playId, playedFrom, player, true)) return true;
        }
        break;
      default: break;
    }
  }

  switch(cardId)
  {
    case "SOR_213"://Syndicate Lackeys
    case "SOR_117"://Mercenary Company
    case "SOR_195"://Auzituck Liberator Gunship
    case "SOR_101"://Rogue Squadron Skirmisher
    case "SOR_149"://Mace Windu - Party Crasher
    case "SOR_182"://Bossk (Deadly Stalker)
    case "SOR_115"://Agent Kallus
    case "SOR_244"://Snowspeeder
    case "SOR_183"://Bounty Hunter Crew
    case "SOR_198"://Han Solo - Reluctant Hero
    case "SOR_087"://Darth Vader - Commanding the First Legion
    case "SHD_100"://Modded Cohort
    case "SHD_216"://Chain Code Collector
    case "SHD_220"://Fennec Shand
    case "SHD_090"://Maul
    case "SHD_102"://The Marauder
    case "SHD_210"://Cloud-Rider
    case "SHD_219"://Enfys Nest
    case "SHD_188"://4-LOM
    case "SHD_119"://Weequay Pirate Gang
    case "SHD_122"://Arquitens Assault Cruiser
    case "TWI_214"://Hidden Sharpshooter
    case "TWI_242"://Phase II Clone Trooper
    case "TWI_112"://Subjugating Starfighter
    case "TWI_118"://Gor
    case "TWI_196"://Plo Koon
    case "JTL_096"://Blue Leader
    case "JTL_204"://Home One
    case "JTL_203"://Han Solo - Has His Moments
    case "JTL_087"://TIE Ambush Squadron
    case "JTL_198"://Fireball
    case "JTL_216"://Contracted Hunter
    case "JTL_214"://X-34 Landspeeder
    case "JTL_225"://Corporate Light Cruiser
    case "JTL_112"://Eager Escort Fighter
    case "JTL_105"://The Starhawk
    case "JTL_259"://Retrofitted Airspeeder
    case "LOF_200"://Qui-Gon Jinn unit
    case "LOF_199"://Depa Billaba
    case "LOF_113"://Jedi Temple Guards
    case "LOF_088"://Eye of Sion
    case "LOF_089"://Supremacy
    case "LOF_210"://Charging Phillak
    case "LOF_257"://Kowakian Monkey-Lizard
    case "LOF_208"://Mysterious Hermit
    case "LOF_087"://Eighth Brother
    case "SEC_087"://Dedra Meero
    case "SEC_209"://The Mandalorian
      return true;
  }
  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId !== "0" && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId
        && HasAmbush("JTL_053", theGhostPlayId, playedFrom, player))
      return true;
  }

  return false;
}