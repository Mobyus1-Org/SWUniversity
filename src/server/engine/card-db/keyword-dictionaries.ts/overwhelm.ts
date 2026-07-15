import { GetUnitInPlay, LeaderAbilitiesIgnored, GetUnitsForPlayer, IsCoordinateActive, TraitContains, GetCurrentEffectsForPlayer, PlayerHasUnitWithTraitInPlay, HasTheForce, GetPlayIdForUniqueUnitInPlay } from "@/server/engine/core-functions";
import { PlayerId } from "@/lib/engine/core-models";
import { CardCost } from "@/server/engine/card-db/generated";
import { SupportGrantedCardId } from "@/server/engine/card-db/keyword-dictionaries.ts/support";

/**
 * @param defenderPlayId - playId of the defending unit. When provided,
 *   indicates we are attacking a unit (used to derive `attackingUnit` and for
 *   conditional-overwhelm checks on SOR_130 / SHD_138).
 * @param defenderPlayer - the controller of the defending unit.
 */
export function HasOverwhelm(cardId: string,
  playId?: string,
  player?: PlayerId,
  defenderPlayId?: string,
  defenderPlayer?: PlayerId,
  isRecursion = false
)
{
  // Overwhelm is only relevant when attacking a unit – infer from whether a
  // defender was supplied.  Callers that provide no defenderPlayId are doing
  // a static keyword check and we conservatively treat it as NOT attacking.
  const attackingUnit = defenderPlayId != null;
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasOverwhelm");
    if(unit.LostAbilities()) return false;
    //Support: the attacker has gained the supporting unit's keywords for this attack.
    const supported = SupportGrantedCardId(playId, player);
    if (supported && HasOverwhelm(supported)) return true;
    const units = GetUnitsForPlayer(player);
    //other units passive abilities that give overwhelm
    for(const u of units)
    {
      switch(u.cardId)
      {
        case "SHD_007"://Moff Gideon - Formidable Commander "Each friendly unit that costs 3 or less gets +1/+0 and gains Overwhelm while attacking an enemy unit."
          if (attackingUnit && CardCost(unit.cardId) <= 3) return true;
          break;
        case "TWI_009"://Maul Leader Unit
          if(u.playId !== playId && !LeaderAbilitiesIgnored()) return true;
          break;
        case "TWI_114"://Clone Commander Cody
          if(u.playId !== playId && IsCoordinateActive(player)) return true;
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
      case "SOR_130"://First Legion Snowtrooper "While attacking a damaged unit, this unit gets +2/0 and gains Overwhelm."
        if (!defenderPlayId || !defenderPlayer) break;
        return GetUnitInPlay(defenderPlayId, defenderPlayer)?.IsDamaged();
      case "SHD_138"://Jango Fett - Renowned Bounty Hunter "While attacking a unit with a Bounty, this unit gets +3/+0 and gains Overwhelm."
        if (!defenderPlayId || !defenderPlayer) break;
        return GetUnitInPlay(defenderPlayId, defenderPlayer)?.HasBounty();
      case "SHD_169"://Clan Challengers
        return upgrades.length > 0;
      case "TWI_130"://Bo-Katan Kryze
        return PlayerHasUnitWithTraitInPlay(player, "Mandalorian", true, playId);
      case "JTL_137"://Vonreg's TIE Interceptor
        return unit.CurrentPower() >= 4;
      case "LOF_007"://Avar Kriss Leader unit
        return HasTheForce(player);
      case "LOF_105"://Oppo Rancisis
        if(isRecursion) return false; //Prevent recursion
        for(const u of units) {
          if(u.playId === playId) continue;
          if(HasOverwhelm(u.cardId, u.playId, player)) return true;
        }
        break;
      default: break;
    }
  }

  switch(cardId)
  {
    //leader units
    case "LAW_010"://Leia Organa (LAW) Leader Unit - Someone Who Loves You
    case "SHD_007"://Moff Gideon Leader Unit
    case "TWI_012"://Anakin Skywalker Leader Unit
    case "TWI_005"://Count Dooku Leader Unit
    case "TWI_009"://Maul Leader Unit
      return !LeaderAbilitiesIgnored();
    //non-leader units
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
    case "SEC_081"://Major Partagaz
    case "LAW_038"://Lepi Lookout
    case "LAW_081"://Sullustan Sapper
    case "LAW_162"://Beach Patrol AT-ACT
    case "LAW_177"://Son-tuul Berserkers
    case "LAW_259"://Cartel Heavy Fighter
    case "ASH_029"://Scorpenek Annihilator Droid
    case "ASH_096"://Forest Patroller
    case "ASH_121"://Blurrg
    case "ASH_241"://Marrok's Fiend Fighter
    case "ASH_129"://Defenders of the Forest
    case "ASH_143"://Tempest Lieutenant
    case "ASH_164"://Alamite Hunter
      return true;
    default: break;
  }
  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId !== "0" && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId
        && HasOverwhelm("JTL_053", theGhostPlayId, player))
      return true;
  }

  return false;
}