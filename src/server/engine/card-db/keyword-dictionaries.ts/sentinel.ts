import { PlayerId } from "@/lib/engine/core-models";
import { GetCurrentEffectsForPlayer, GetPlayIdForUniqueUnitInPlay, GetUnitInPlay, GetUnitsForPlayer, HasTheForce, InitiativePlayer, IsCoordinateActive, GetResources, NumberOfUnitsInArena, PlayerControlsCardWithTrait, PlayerHasUnitInPlayWithMinimumPower, PlayerHasUnitWithAspectInPlay, PlayerHasUnitWithTraitInPlay, TraitContains } from "@/server/engine/core-functions";
import { CardAspects } from "@/server/engine/card-db/generated";

export function HasSentinel(cardId: string, playId?: string, player?: PlayerId, isRecursion = false)
{
  if (player && playId) {
    const otherPlayer = player == 1 ? 2 : 1;
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasSentinel");
    if (unit.LostAbilities()) return false;

    let hasSentinel = false;
    //Effect Sentinel
    for(const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if(currentEffect.cardId ==  "JTL_047_Sentinel" && TraitContains(cardId, "Vehicle", player)) return true;//Admiral Yularen - Fleet Coordinator
      if (currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) {
        continue;
      }

      switch(currentEffect.cardId) {
        case "SOR_086": hasSentinel = true; break;//Gladiator Star Destroyer
        case "SOR_003": hasSentinel = true; break;//Chewbacca (Walking Carpet)
        case "SHD_103": hasSentinel = true; break;//General Rieekan
        case "TWI_074": hasSentinel = true; break;//Guarding The Way
        case "SOR_140": return false;//SpecForce Soldier
        case "TWI_015": hasSentinel = true; break;//General Grievous Leader / Leader unit
        case "JTL_077": hasSentinel = true; break;//In The Heat of Battle
        case "TWI_033": if (cardId == "TWI_033") {hasSentinel = true;} break;//Calculating MagnaGuard
        case "TWI_046": hasSentinel = true; break;//Captain Typho
        case "TWI_250"://Sword and Shield Maneuver
          if(TraitContains(cardId, "Jedi", player)) hasSentinel = true;
          break;
        case "JTL_229": hasSentinel = true; break;//Diversion
        case "JTL_130": hasSentinel = true; break;//Timely Reinforcements
        //Legends of the Force
        case "LOF_008": hasSentinel = true; break;//Obi-Wan Kenobi (Protective Padawan)
        case "LOF_003": hasSentinel = true; break;//Ahsoka Tano Leader / Leader unit
        case "LOF_223": hasSentinel = true; break;//Force Illusion
        //Secrets of Power
        case "SEC_082": hasSentinel = true; break;//Chancellor Palpatine unit (SEC)
        default: break;
      }
    }
    if(hasSentinel) return true;
    //Upgrades Sentinel
    const upgrades = unit.upgrades;
    for(const u of upgrades)
    {
      switch(u.cardId) {
        case "SOR_057"://Protector
        case "TWI_071"://Unshakeable Will
        case "JTL_058"://Academy Graduate
        case "JTL_003"://Lando Calrissian leader unit
        case "ASH_198"://Nowhere to Hide
          hasSentinel = true;
          break;
        //conditional upgrade sentinel
        case "JTL_109"://Jarek Yeager
          hasSentinel = NumberOfUnitsInArena(player, "Ground") > 0
            && NumberOfUnitsInArena(player, "Space") > 0;
            break;
        case "LOF_261"://Constructed Lightsaber
          if(!CardAspects(cardId)?.includes("Villainy") && !(CardAspects(cardId)?.includes("Heroism"))) hasSentinel = true;
          break;
        default: break;
      }
    }
    if(hasSentinel) return true;
    const units = GetUnitsForPlayer(player);
    switch(cardId) {
      //conditional sentinel
      //Spark of Rebellion
      case "SOR_211"://Gamorrean Guards
        return PlayerHasUnitWithAspectInPlay(player, "Cunning", true, playId);
      case "SOR_113"://Homestead Militia (SOR)
      case "JTL_113"://Homestead Militia (JTL)
        return GetResources(player).length >= 6;
      case "SOR_048"://Vigilant Honor Guards
        return !unit.IsDamaged();
      case "SOR_065"://Baze Melbus
        return InitiativePlayer() === player;
      case "SOR_082"://Emperor's Royal Guard
      //Shadows of the Galaxy
        return PlayerHasUnitWithTraitInPlay(player, "Official");
      case "SHD_247"://Protector of the Throne
        return upgrades.length > 0;
      case "SHD_112"://Gamorrean Retainer
          return PlayerHasUnitWithAspectInPlay(player, "Command", true, playId);
      case "SHD_034"://Supercommando Squad
        return upgrades.length > 0;
      case "SHD_052"://Sugi
        return GetUnitsForPlayer(otherPlayer).some(u => u.upgrades?.length > 0);
      //Twilight of the Republic
      case "TWI_043"://Outspoken Representative
        return PlayerHasUnitWithTraitInPlay(player, "Republic", true, playId);
      case "TWI_061"://Infantry of the 212th
        return IsCoordinateActive(player);
      case "TWI_054"://Duchess's Champion
        return IsCoordinateActive(otherPlayer);
      //Jump to Lightspeed
      case "JTL_104"://Raddus
        return PlayerControlsCardWithTrait(player, "Resistance", true, playId);
      case "JTL_107"://Bunker Defender
        return PlayerHasUnitWithTraitInPlay(player, "Vehicle");
      case "JTL_053"://The Ghost
        return upgrades.length > 0;
      //Legends of the Force
      case "LOF_196"://Jedi Sentinel
        return HasTheForce(player);
      case "LOF_085"://Praetorian Guard
        return PlayerHasUnitInPlayWithMinimumPower(player, 4);
      case "LOF_105": //Oppo Rancisis
        if(isRecursion) return false; //Prevent recursion
        for(const u of units) {
          if(u.playId == playId) continue;
          if(HasSentinel(u.cardId, u.playId, player, true)) return true;
        }
        break;
      //Secrets of Power
      case "SEC_079"://Corrupt Politician
        return GetUnitsForPlayer(player).length > GetUnitsForPlayer(otherPlayer).length;
      default: break;
    }
  }

  //Self Sentinel
  switch(cardId) {
    case "SOR_003"://Chewbacca - Walking Carpet
    case "SOR_035"://Lieutenant Childsen
    case "SOR_037"://Academy Defense Walker
    case "SOR_049"://Obi-Wan Kenobi
    case "SOR_052"://Redemption
    case "SOR_056"://Bendu
    case "SOR_063"://Cloud City Wing Guard
    case "SOR_066"://System Patrol Craft
    case "SOR_090"://Devastator
    case "SOR_098"://Echo Base Defender
    case "SOR_099"://Bright Hope
    case "SOR_196"://Chewbacca
    case "SOR_229"://Cell Block Guard
    case "SOR_250"://Corellian Freighter
    case "SHD_029"://Pyke Sentinel
    case "SHD_035"://Clan Saxon Gauntlet
    case "SHD_065"://Vigilant Pursuit Craft
    case "SHD_042"://Concord Dawn Interceptors
    case "SHD_043"://Village Protectors
    case "SHD_049"://The Mandalorian unit
    case "SHD_062"://Niima Outpost Constables
    case "SHD_084"://Phase-III Dark Trooper
    case "SHD_089"://Pirate Battle Tank
    case "SHD_237"://Black Sun Starfighter
    case "TWI_003"://Obi-wan Kenobi
    case "TWI_037"://Droideka Security
    case "TWI_065"://Falchion Ion Tank
    case "TWI_098"://Republic Defense Carrier
    case "TWI_113"://B2 Legionnaires
    case "TWI_118"://Gor
    case "TWI_207"://B1 Security Team
    case "TWI_232"://Patrolling AAT
    case "TWI_245"://Armored Saber Tank
    case "JTL_003"://Lando Calrissian leader unit
    case "JTL_040"://Fleet Interdictor
    case "JTL_058"://Academy Graduate
    case "JTL_064"://Omicron Strike Craft
    case "JTL_068"://Perimeter AT-RT
    case "JTL_072"://Wing Guard Security Team
    case "JTL_110"://Scouting Headhunter
    case "JTL_184"://Contracted Jumpmaster
    case "JTL_224"://Shadowed Hover Tank
    case "JTL_241"://Rogue-Class Starfighter
    case "JTL_252"://Tantive IV
    case "LOF_001"://Kylo Ren - We're Not Done Yet
    case "LOF_034"://Supremacy TIE/sf
    case "LOF_044"://Loth-Wolf
    case "LOF_067"://Chirrut Imwe
    case "LOF_069"://Graceful Purrgil
    case "IBH_003"://Chewbacca
    case "IBH_014"://Bright Hope
    case "IBH_070"://Blizzard Force AT-ST
    case "IBH_079"://Death Squadron Star Destroyer
    case "SEC_036"://Dogmatic Shock Squad
    case "SEC_049"://Jade Squadron Patrol
    case "SEC_057"://Lobot
    case "SEC_098"://Captain Typho
    case "SEC_262"://Ando Commission
      return true;
  }

  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId !== "0" && TraitContains(cardId, "Spectre", player)
      && playId !== theGhostPlayId
      && HasSentinel("JTL_053", theGhostPlayId, player))

    return true;
  }

  return false;
}