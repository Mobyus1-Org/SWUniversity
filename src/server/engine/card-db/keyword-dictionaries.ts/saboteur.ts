import { PlayerId } from "@/lib/engine/core-models";
import { GetCurrentEffectsForPlayer, GetHand, GetPlayIdForUniqueUnitInPlay, GetUnitInPlay, GetUnitsForPlayer, IsCoordinateActive, PlayerHasUnitWithTraitInPlay, TraitContains, UnitWasDefeatedThisPhase } from "../../core-functions";
import { CardTitle } from "../generated";

export function HasSaboteur(cardId: string, playId?: string, player?: PlayerId, isRecursion = false)
{
  if (player && playId) {
    const otherPlayer = player == 1 ? 2 : 1;
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasSaboteur");
    if (unit.LostAbilities()) return false;

    for(const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if(currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) continue;

      switch(currentEffect.cardId) {
        case "SHD_230": return true;//Swoop Down
        case "SOR_168": return true;//Precision Fire
        case "TWI_224": return true;//Breaking In
        case "TWI_249": return true;//Heroes on Both Sides
        //Jump to Lightspeed
        case "JTL_077": return false;//In The Heat of Battle
        case "JTL_015": return true;//Rio Durant leader
        //Legends of the Force
        case "LOF_191": return true;//BD-1
        case "LOF_152": //Focus Determines Reality
          return TraitContains(cardId, "Force", player);
        default: break;
      }
    }
    const upgrades = unit.upgrades;
    for(const u of upgrades)
    {
      switch(u.cardId) {
        case "SOR_166"://Infiltrator's Skill
        case "JTL_015"://Rio Durant
        case "LOF_215"://Ascension Cable
          return true;
        default: break;
      }
    }
    const units = GetUnitsForPlayer(player);
    for(const u of units)
    {
      switch(u.cardId)
      {
        case "SHD_190"://Zuckuss
          if(CardTitle(cardId) == "4-LOM") return true;
          break;
        default: break;
      }
    }

    //conditional saboteur
    switch (cardId) {
      case "TWI_243"://Republic Commando
        return IsCoordinateActive(player);
      case "TWI_010"://Pre Viszla - Pursuing The Throne
        return GetHand(player).length >= 3;
        break;
      case "TWI_130"://Bo-Katan Kryze - Death Watch Lieutenant
        return PlayerHasUnitWithTraitInPlay(player, "Mandalorian", true, playId);
      case "TWI_143"://Jyn Erso - Stardust
        return UnitWasDefeatedThisPhase(otherPlayer);
      case "LOF_105"://Oppo Rancisis
        if(isRecursion) return false; //Prevent recursion
        for(const u of units) {
          if(u.playId === playId) continue;
          if(HasSaboteur(u.cardId, u.playId, player, true)) return true;
        }
        break;
    }
  }

  switch(cardId)
  {
    //Spark of Rebellion
    case "SOR_194"://Rogue Operative
    case "SOR_205"://Jawa Scavenger
    case "SOR_239"://Rebel Pathfinder
    case "SOR_160"://Wolffe
    case "SOR_158"://Jedha Agitator
    case "SOR_143"://Fighters for Freedom
    case "SOR_133"://Seventh Sister
    case "SOR_197"://Lando Calrissian - Responsible Businessman
    case "SOR_013"://Cassian Andor - Dedicated to the Rebellion
    case "SHD_190"://Zuckuss
    case "SHD_147"://Ketsu Onyo
    case "SHD_162"://House Kast Soldier
    case "SHD_016"://Fennec Shand
    case "SHD_151"://Valiant Assault Ship
    case "SHD_134"://Guavian Antagonizer
    case "SHD_218"://Resourceful Pursuers
    case "SHD_165"://Unlicensed Headhunter
    case "TWI_148"://Senatorial Corvette
    case "TWI_228"://Droid Starfighter
    case "TWI_161"://Bold Recon Commando
    case "TWI_182"://Infiltrating Demolisher
    case "TWI_165"://Kit Fisto
    case "TWI_198"://Enfys Nest - Champion of Justice
    case "TWI_216"://Fives
    case "JTL_015"://Rio Durant - Wisecracking Wheelman
    case "JTL_168"://Insurgent Saboteurs
    case "JTL_166"://Orbiting K-Wing
    case "LOF_011"://Kit Fisto - Focused Jedi Master
    case "LOF_147"://Kit Fisto's Aethersprite
    case "LOF_166"://Blockade Runner
    case "LOF_199"://Depa Billaba
    case "SEC_199"://Bravo Squadron Fighter
      return true;
    default: break;
  }
  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId
        && HasSaboteur("JTL_053", theGhostPlayId, player))
      return true;
  }

  return false;
}