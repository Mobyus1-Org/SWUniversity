import { GetCurrentEffectsForPlayer, GetPlayIdForUniqueUnitInPlay, GetUnitInPlay, GetUnitsForPlayer, InitiativePlayer, IsCoordinateActive, LeaderAbilitiesIgnored, PlayerHasUnitWithTraitInPlay, TraitContains } from "@/server/engine/core-functions";
import { PlayerId } from "@/lib/engine/core-models";
import { CardAspects } from "@/server/engine/card-db/generated";
import { SupportGrantedCardId } from "@/server/engine/card-db/keyword-dictionaries.ts/support";

export function RestoreAmount(cardId: string, playId?: string, player?: PlayerId, isRecursion = false): number
{
  let amount = 0;

  if (player && playId) {
    //Support: the attacker has gained the supporting unit's keywords for this attack.
    const supported = SupportGrantedCardId(playId, player);
    if (supported) amount += RestoreAmount(supported);
    //restore from effects
    for (const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if (currentEffect.cardId === "JTL_047_Restore_1" && TraitContains(cardId, "Vehicle", player)) {
        amount += 1;//Admiral Yularen - Fleet Coordinator
      }
      if (currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) {
        continue;
      }

      switch(currentEffect.cardId) {
        case "ASH_004_restore"://Grand Admiral Thrawn leader Action
          amount += 2;
          break;
        case "TWI_129"://In Defense of Kamino
          amount += 2;
          break;
        case "JTL_097"://Leia Organa - Pilots, To Your Stations
          amount += 1;
          break;
        case "LOF_045"://Yaddle - A Chance To Make Things Right
          amount += 1;
          break;
        default: break;
      }
    }
    //passive effects from other units in play
    const units = GetUnitsForPlayer(player);
    for(const u of units)
    {
      switch(u.cardId) {
        case "SOR_102": //Home One
          if(u.playId !== playId) amount += 1;
          break;
        default: break;
      }
    }

    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in RestoreAmount");
    const upgrades = unit.upgrades;
    for(const u of upgrades) {
      const upgradeCardID = u.cardId;
      switch(upgradeCardID) {
        case "SOR_070": //Devotion
          amount += 2;
          break;
        case "TWI_051"://For The Republic
          amount += IsCoordinateActive(player) ? 2 : 0;
          break;
        case "JTL_045"://Hera Syndulla Pilot
          amount += 1;
          break;
        case "LOF_053"://Heriloom Lightsaber
          amount += TraitContains(cardId, "Force", player) ? 1 : 0;
          break;
        case "LOF_261"://Constructed Lightsaber
          amount += CardAspects(cardId)?.includes("Heroism") ? 2 : 0;
          break;
      }
    }

    //conditional restore
    switch(cardId) {
      case "SOR_112": amount += InitiativePlayer() === player ? 2 : 0; break;//Consortium Starviper
      case "TWI_062": amount += unit?.IsDamaged() ? 0 : 2; break;//Daughter of Dathomir
      case "LOF_105"://Oppo Rancisis
        if(isRecursion) return 0; //Prevent recursion
        for(const u of units) {
          if(u.playId === unit?.playId) continue;
          if(RestoreAmount(u.cardId, u.playId, player, true) > 0) {
            amount += 2;
            break;
          }
        }
        break;
      case "SEC_116": amount += PlayerHasUnitWithTraitInPlay(player, "Official") ? 2 : 0; break;//Nubian Star Skiff
      default: break;
    }
  }

  switch (cardId) {
    case "SOR_001": amount += !LeaderAbilitiesIgnored() ? 2 : 0; break;//Director Krennic - Aspiring To Authority
    case "SOR_034": amount += 1; break;//Del Meeko
    case "SOR_044": amount += 1; break;//Restored Arc 170
    case "SOR_045": amount += 2; break;//Yoda - Old Master
    case "SOR_051": amount += 3; break;//Luke Skywalker - Jedi Knight
    case "SOR_097": amount += 1; break;//Admiral Ackbar
    case "SOR_102": amount += 2; break;//Home One
    case "SOR_243": amount += 2; break;//Regional Sympathizers
    case "SHD_004": amount += 3; break;//Rey - More Than A Scavenger
    case "SHD_041": amount += 1; break;//Kuiil - I Have Spoken
    case "SHD_044": amount += 2; break;//Razor Crest
    case "SHD_055": amount += 2; break;//Moisture Farmer
    case "SHD_095": amount += 1; break;//Clone Deserter
    case "SHD_098": amount += 2; break;//Sundari Peacekeeper
    case "SHD_099": amount += 2; break;//Echo
    case "SHD_250": amount += 2; break;//Tarfful
    case "SHD_259": amount += 2; break;//Twin Pod Cloud Car
    case "TWI_004": amount += 2; break;//Yoda - Sensing Darkness
    case "TWI_008": amount += 1; break;//Padme Amidala - Seving The Republic
    case "TWI_035": amount += 1; break;//Morgan Elsbeth
    case "TWI_039": amount += 2; break;//Malevolence
    case "TWI_092": amount += 1; break;//Admiral Yularen
    case "TWI_244": amount += 2; break;//ETA-2 Light Interceptor
    case "TWI_247": amount += 3; break;//AT-TE Vanguard
    case "JTL_038": amount += 2; break;//Corvus
    case "JTL_045": amount += 1; break;//Hera Syndulla
    case "JTL_071": amount += 2; break;//CR90 Relief Runner
    case "JTL_097": amount += 1; break;//Leia Organa
    case "JTL_114": amount += 2; break;//Adept ARC-170
    case "LOF_017": amount += 1; break;//Darth Revan
    case "LOF_032": amount += 2; break;//Magistrate's Scout
    case "LOF_039": amount += 2; break;//Darth Sidious
    case "ASH_102": amount += 2; break;//Ravager - Final Imperial Command
    case "LOF_045": amount += 1; break;//Yaddle
    case "LOF_057": amount += 2; break;//Owen Lars
    case "LOF_088": amount += 1; break;//Eye of Sion
    case "LOF_107": amount += 1; break;//Village Tender
    case "LOF_110": amount += 1; break;//Hive Defense Wing
    case "LOF_113": amount += 2; break;//Jedi Temple Guards
    case "LOF_116": amount += 2; break;//Relic Scavenger
    case "LOF_121": amount += 4; break;//The Purrgil King
    case "LOF_247": amount += 1; break;//Gungan Warrior
    case "LOF_253": amount += 1; break;//Longbeam Cruiser
    case "IBH_020": amount += 2; break;//Luke Skywalker
    case "IBH_058": amount += 1; break;//Lambda Shuttle
    case "SEC_005": amount += 4; break;//Satine Kryze
    case "SEC_043": amount += 2; break;//Chandrilan Sponsor
    case "SEC_094": amount += 1; break;//Mina Bonteri
    case "SEC_103": amount += 3; break;//Mon Mothma
    case "LAW_050": amount += 2; break;//Honnah
    case "LAW_070": amount += 1; break;//Devaronian Doorbuster
    case "LAW_090": amount += 1; break;//Toydarian Technician
    case "LAW_120": amount += 2; break;//Vigilant Scouts
    case "LAW_153": amount += 1; break;//Follower of the Code
    case "ASH_076": amount += 2; break;//Remnant Official
    case "ASH_095": amount += 1; break;//Remnant Interceptor
    case "ASH_096": amount += 1; break;//Forest Patroller
    case "ASH_106": amount += 1; break;//Pathfinder Sergeant
    case "ASH_256": amount += 1; break;//Rebel Infiltrators
    case "ASH_112": amount += 1; break;//Luke Skywalker
    default: break;
  }

  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId !== "0" && TraitContains(cardId, "Spectre", player)
      && playId !== theGhostPlayId
      && RestoreAmount("JTL_053", theGhostPlayId, player) > 0)

    amount += RestoreAmount("JTL_053", theGhostPlayId, player);
  }

  if(amount > 0 && playId && GetUnitInPlay(playId, player)?.LostAbilities()) return 0;

  return amount;
}