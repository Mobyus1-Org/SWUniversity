import { GetUnitInPlay, LeaderAbilitiesIgnored, GetUnitsForPlayer, IsCoordinateActive, TraitContains, GetCurrentEffectsForPlayer, PlayerHasUnitWithTraitInPlay, HasTheForce, GetPlayIdForUniqueUnitInPlay } from "../../core-functions";
import { PlayerId } from "../../core-models";

export function HasOverwhelm(cardId: string, playId?: string, player?: PlayerId, isRecursion = false)
{
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasOverwhelm");
    if(unit.LostAbilities()) return false;
    const units = GetUnitsForPlayer(player);
    //other units passive abilities that give overwhelm
    for(const u of units)
    {
      switch(u.cardId)
      {
        case "SHD_007"://Moff Gideon - Formidable Commander
          //need to figure out combat first to see how to check "defending unit" or "attack target is unit"
          //if(CardCost(unit.cardId)! <= 3 && ) return true;
          break;
        case "TWI_009"://Maul Leader Unit
          if(unit.playId !== playId && !LeaderAbilitiesIgnored()) return true;
          break;
        case "TWI_114"://Clone Commander Cody
          if(unit.playId !== playId && IsCoordinateActive(player)) return true;
          break;
        case "JTL_161"://Captain Tarkin
          if(TraitContains(unit.cardId, "Vehicle", player)) return true;
          break;
        case "SEC_099"://Naboo Royal Starship
          if(unit.IsLeader()) return true;
          break;
        default: break;
      }
    }
    //Check current effects for overwhelm
    for (const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if (currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) continue;
      switch(currentEffect.cardId) {
        case "TWI_009"://Maul Leader
          return !LeaderAbilitiesIgnored();
        case "SHD_155"://Heroic Resolve
        case "TWI_178"://Planetary Invasion
        case "LOF_140"://Darth Maul's Lightsaber
        case "LOF_114"://Kaadu
        case "LOF_126"://Overpower
          return true;
        default: break;
      }
    }
    // Check upgrades
    const upgrades = unit.upgrades;
    for (const u of upgrades) {
      switch(u.cardId) {
        case "TWI_236"://Grievous's Wheel Bike
        case "TWI_119"://Nameless Valor
          return true;
        case "JTL_150"://Biggs Darklighter
          if(TraitContains(u.cardId, "Fighter", player)) return true;
      }
    }

    //conditional overwhelm
    switch(cardId) {
      case "SHD_169"://Clan Challengers
        return upgrades.length > 0;
      case "TWI_130"://Bo-Katan Kryze
        return PlayerHasUnitWithTraitInPlay(player, "Mandalorian", true, playId);
      case "JTL_137"://Vonreg's TIE Interceptor
        return unit.CurrentPower(true) >= 4;
      case "LOF_007"://Avar Kriss Leader unit
        return HasTheForce(player);
      case "LOF_105"://Oppo Rancisis
        if(isRecursion) return false; //Prevent recursion
        for(const u of units) {
          if(u.playId === playId) continue;
          if(HasOverwhelm(u.cardId, u.playId, player, true)) return true;
        }
        break;
      default: break;
    }
  }

  switch(cardId)
  {
    case "SOR_232"://AT-ST
    case "SOR_164"://Wampa
    case "SOR_117"://Mercenary Company
    case "SOR_135"://Emperor Palpatine (Master of the Dark Side)
    case "SOR_145"://K-2SO (Cassian's Counterpart)
    case "SOR_090"://Devastator (Inescapable)
    case "SOR_116"://Steadfast Battalion
    case "SHD_136"://Death Watch Loyalist
    case "SHD_154"://Wrecker
    case "SHD_118"://Kihraxz Heavy Fighter
    case "SHD_242"://Gideon's Light Cruiser
    case "SHD_172"://Krayt Dragon
    case "SHD_090"://Maul
    case "SHD_158"://Wild Rancor
    case "SHD_235"://Ruthless Assassin
    case "SHD_140"://Trandoshan Hunters
    case "SHD_009"://Hunter (Outcast Sergeant)
    case "JTL_140"://IG-2000
    case "JTL_154"://Profundity
    case "JTL_163"://AT-DP Occupier
    case "SHD_092"://Finalizer
    case "JTL_090"://Executor
      return true;
    case "SOR_130"://First Legion Snowtrooper
      // $target = GetAttackTarget();
      // if($target == "THEIRCHAR-0") return false;
      // $targetAlly = new Ally($target, $defPlayer);
      // return $targetAlly->IsDamaged();
      break;
    case "SHD_138"://Jango Fett (Renowned Bounty Hunter)
      // if(IsAllyAttackTarget() && $mainPlayer == $player) {
      //   $targetAlly = new Ally(GetAttackTarget(), $defPlayer);
      //   if($targetAlly->HasBounty()) return true;
      // }
      return false;
    case "TWI_093"://Advanced Recon Commando
    case "TWI_159"://Dendup's Loyalist
    case "TWI_113"://B2 Legionnaires
    case "TWI_118"://Gor
    case "TWI_166"://Aurra Sing
    case "TWI_149"://Low Altitude Gunship
    case "TWI_138"://Count Dooku (Fallen Jedi)
    case "JTL_118"://MC30 Assault Frigate
    case "JTL_138"://Decimator of Dissidents
    case "TWI_114"://Clone Commander Cody
      return true;
    case "SHD_007"://Moff Gideon Leader Unit
    case "TWI_012"://Anakin Skywalker Leader Unit
    case "TWI_005"://Count Dooku Leader Unit
    case "TWI_009"://Maul Leader Unit
      return !LeaderAbilitiesIgnored();
    //Legends of the Force
    case "LOF_137"://Savage Opress
    case "LOF_234"://Darth Malak
    case "LOF_131"://Strikeship
    case "LOF_001"://Kylo Ren LOF
    case "LOF_086"://Drengir Spawn
    case "LOF_149"://Mace Windu
    case "LOF_088"://Eye of Sion
    case "LOF_080"://Exegol Patroller
    case "LOF_109"://Mynock
    case "LOF_120"://Trident Assault Ship
      return true;
    //Secrets of Power
    case "SEC_081"://Major Partagaz
      return true;
    default: break;
  }
  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId
        && HasOverwhelm("JTL_053", theGhostPlayId, player))
      return true;
  }

  return false;
}