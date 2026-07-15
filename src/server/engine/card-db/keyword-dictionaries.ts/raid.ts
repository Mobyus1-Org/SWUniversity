import { PlayerId } from "@/lib/engine/core-models";
import { GetCurrentEffectsForPlayer, GetHand, GetPlayIdForUniqueUnitInPlay, GetUnitInPlay, GetUnitsForPlayer, IsCoordinateActive, LeaderAbilitiesIgnored, PlayerControlsCardWithTitle, PlayerHasTokenUnitInPlay, PlayerHasUnitWithAspectInPlay, PlayerHasUnitWithTraitInPlay, TraitContains } from "@/server/engine/core-functions";
import { CardAspects } from "@/server/engine/card-db/generated";
import { SupportGrantedCardId } from "@/server/engine/card-db/keyword-dictionaries.ts/support";

export function RaidAmount(cardId: string, playId?: string, player?: PlayerId, isRecursion = false): number {
  let amount = 0;
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) return amount;
    if (unit.LostAbilities()) return 0;
    //Support: the attacker has gained the supporting unit's keywords for this attack.
    const supported = SupportGrantedCardId(playId, player);
    if (supported) amount += RaidAmount(supported);
    // LAW_233 Galen Erso: enemy units (of Galen's controller) gain Raid 1.
    if (GetPlayIdForUniqueUnitInPlay("LAW_233", player === 1 ? 2 : 1) !== "0") amount += 1;
    const units = GetUnitsForPlayer(player);
    for(const u of units) {
      switch(u.cardId)
      {
        case "SOR_144"://Red Three
          if(playId !== u.playId && CardAspects(cardId).includes("Heroism")) amount += 1;
          break;
        case "SOR_012"://IG-88 Leader Unit
          if(playId !== u.playId) amount += 1;
          break;
        case "JTL_134"://General Hux
          if(playId != u.playId && TraitContains(cardId, "First Order", player, playId)) amount += 1;
          break;
        case "LOF_169"://Invasion Control Ship
          if(TraitContains(cardId, "Droid", player, playId)) amount +=2;
          break;
        case "SEC_099"://Naboo Royal Starship
          if(unit.IsLeader()) amount += 2;
          break;
        default: break;
      }
    }
    for(const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if(currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) continue;
      switch(currentEffect.cardId) {
        case "SOR_156"://Benthic "Two Tubes"
          amount += 2;
          break;
        case "SOR_154"://Rallying Cry
          amount += 2;
          break;
        case "TWI_250"://Sword and Shield Maneuver
          amount += TraitContains(cardId, "Trooper", player, playId) ? 1 : 0;
          break;
        case "LOF_152"://Focus Determines Reality
          amount += TraitContains(cardId, "Force", player, playId) ? 1 : 0;
          break;
        default: break;
      }
    }
    const upgrades = unit.upgrades;
    for(const u of upgrades) {
      switch(u.cardId) {
        case "TWI_169"://Clone Cohort
          amount += 2;
          break;
        case "JTL_211"://Independent Smuggler
          amount += 1;
          break;
        case "LOF_261"://Constructed Lightsaber
          if(CardAspects(cardId).includes("Villainy")) amount += 2;
          break;
        default: break;
      }
    }
    const otherPlayer = player === 1 ? 2 : 1;
    switch (unit.cardId) {
      //conditional raid
      case "SOR_159": amount += PlayerHasUnitWithAspectInPlay(player, "Aggression", true, playId) ? 2 : 0; break;//Partisan Insurgent
      case "SOR_131": amount += unit.TotalHP() - unit.CurrentHP(); break;//Fifth Brother
      case "SOR_188": // Chopper (SOR)
      case "SEC_147": amount += PlayerHasUnitWithTraitInPlay(player, "Spectre", true, playId) ? 1 : 0; break;//Chopper
      case "SHD_168": amount += PlayerHasUnitWithAspectInPlay(player, "Aggression", true, playId) ? 2 : 0; break;//Hunting Nexu
      case "TWI_164": amount += IsCoordinateActive(player) ? 2 : 0; break;//Hevy
      case "TWI_196": amount += IsCoordinateActive(player) ? 3 : 0; break;//Plo Koon
      case "TWI_180": amount += PlayerHasUnitWithTraitInPlay(player, "Separatist", true, playId) ? 2 : 0; break;//Separatist Commando
      case "JTL_081": amount += PlayerHasTokenUnitInPlay(player) ? 1 : 0; break;//First Order TIE Fighter
      case "JTL_257": amount += PlayerHasUnitWithTraitInPlay(player, "Fighter", true, playId) ? 2 : 0; break;//Flanking Fang Fighter
      case "JTL_137": amount += (unit.CurrentPower() + amount) >= 6 ? 1 : 0; break;//Vonreg's TIE Interceptor
      case "LOF_212"://Life Wind Sage
        amount += GetUnitsForPlayer(otherPlayer).some(u => !u.ready) ? 2 : 0;
        break;
      case "LOF_105"://Oppo Rancisis
        if(isRecursion) return 0; //Prevent recursion
        for(const u of units) {
          if(u.playId === playId) continue;
          if(RaidAmount(u.cardId, u.playId, player, true) > 0) {
            amount += 2;
            break;
          }
        }
        break;
      case "SEC_201": //Anakin Skywalker (SEC)
        if (PlayerControlsCardWithTitle(player, "Padmé Amidala")) {
          amount += 2;
        }
        break;
      case "SEC_010"://Dedra Meero leader unit
        amount += !LeaderAbilitiesIgnored()
          ? (GetHand(player).length > GetHand(otherPlayer).length ? 2 : 0)
          : 0;
        break;
    }
  }
  switch(cardId)
  {
    //Leader Units
    case "SOR_009": amount += !LeaderAbilitiesIgnored() ? 1 : 0; break; //Leia Leader Unit
    case "SHD_014": amount += !LeaderAbilitiesIgnored() ? 2 : 0; break; //Cad Bane Leader Unit
    case "SHD_005": amount += !LeaderAbilitiesIgnored() ? 1 : 0; break; //Hondo Ohnaka Leader Unit
    //non-Leader Units
    case "SOR_194": amount += 2; break; //Rogue Operative
    case "SOR_157": amount += 2; break; //Cantina Braggart
    case "SOR_141": amount += 2; break; //Green Squadron A-Wing
    case "SOR_209": amount += 1; break; //Pirated Starfighter
    case "SOR_144": amount += 1; break; //Red Three
    case "SOR_208": amount += 1; break; //Outer Rim Headhunter
    case "SOR_248": amount += 1; break; //Volunteer Soldier
    case "SHD_169": amount += 3; break; //Clan Challengers
    case "SHD_098": amount += 2; break; //Sundari Peacekeeper
    case "SHD_100": amount += 2; break; //Modded Cohort
    case "SHD_191": amount += 2; break; //Xanadu Blood
    case "SHD_187": amount += 2; break; //Lurking TIE Phantom
    case "TWI_108": amount += 1; break; //Ryloth Militia
    case "TWI_145": amount += 1; break; //Jesse
    case "TWI_141": amount += 1; break; //Soldier of the 501st
    case "TWI_150": amount += 2; break; //Saw Gerrera
    case "TWI_104": amount += 1; break; //Obedient Vanguard
    case "TWI_183": amount += 2; break; //Rush Clovis
    case "JTL_111": amount += 1; break; //Seasoned Fleet Admiral
    case "JTL_211": amount += 1; break; //Independent Smuggler
    case "JTL_118": amount += 1; break; //MC30 Assault Frigate
    case "JTL_225": amount += 1; break; //Corporate Light Cruiser
    case "LOF_228": amount += 1; break; //Forged Starfighter
    case "LOF_136": amount += 3; break; //Thralls of the Coven
    case "LOF_131": amount += 3; break; //Strikeship
    case "LOF_179": amount += 2; break; //Aurra Sing
    case "LOF_182": amount += 3; break; //Nihil Marauder
    case "LOF_251": amount += 1; break; //Blue Suqadron Assault Wing
    case "LOF_157": amount += 2; break; //Cartel Interceptor
    case "LOF_132": amount += 1; break; //Grand Inquisitor LOF
    case "LOF_209": amount += 2; break; //Tusken Tracker
    case "IBH_004": amount += 2; break; //Rogue Squadron Speeder
    case "IBH_069": amount += 3; break; //E-Web Gunner
    case "IBH_078": amount += 1; break; //Surface Assault Bomber
    case "IBH_010": amount += 2; break; //Han Solo
    case "SEC_T01": amount += 2; break; //Spy token
    case "SEC_213": amount += 1; break; //A-Wing
    case "LAW_050": amount += 2; break; //Honnah
    case "LAW_082": amount += 4; break; //Urrr'k
    case "LAW_090": amount += 1; break; //Toydarian Technician
    case "LAW_154": amount += 1; break; //Partisan Infantry
    case "LAW_172": amount += 1; break; //Storm Raider
    case "LAW_190": amount += 2; break; //Haxion Aggressor
    case "LAW_199": amount += 3; break; //Ohnaka Gang Bandits
    case "LAW_220": amount += 2; break; //Wookiee Guerilla
    case "LAW_234": amount += 2; break; //Kage Elite
    case "ASH_154": amount += 1; break; //Honorable Nite Owl
    default: break;
  }

  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId !== "0" && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId)
      amount += RaidAmount("JTL_053", theGhostPlayId, player);

      //Marchion Ro
      const marchionRoPlayId = GetPlayIdForUniqueUnitInPlay("LOF_186", player);
      if(marchionRoPlayId !== "0") amount *= 2;
  }

  return amount;
}