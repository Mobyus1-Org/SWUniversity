import { GetCurrentEffectsForPlayer, GetPlayIdForUniqueUnitInPlay, GetUnitsForPlayer, LeaderAbilitiesIgnored, PlayerHasUnitWithAspectInPlay, TraitContains } from "@/server/engine/core-functions";
import { PlayerId } from "@/lib/engine/core-models";

export function HasShielded(cardId: string, playId?: string, player?: PlayerId, isRecursion = false)
{
  if (player && playId) {
    for(const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if(currentEffect.cardId == "JTL_047_Shielded" && TraitContains(cardId, "Vehicle", player)) return true;//Admiral Yularen - Fleet Coordinator
    }

    const otherPlayer = player == 1 ? 2 : 1;
    const units = GetUnitsForPlayer(player);
    const theirUnits = GetUnitsForPlayer(otherPlayer);
    switch (cardId) {
      //conditional shielded
      case "SHD_212"://Privateer Scyk
        return PlayerHasUnitWithAspectInPlay(player, "Cunning", true, playId);
      case "SHD_186"://Hunter of the Haxion Brood
        return theirUnits.some(u => u.HasBounty());
      case "LOF_105"://Oppo Rancisis
        if(isRecursion) return false; //Prevent recursion
        for(const u of units) {
          if(u.playId === playId) continue;
          if(HasShielded(u.cardId, u.playId, player, true)) return true;
        }
      break;
    }
  }

  switch(cardId)
  {
    //leaders when deployed
    case "SOR_002"://Iden Versio (SOR) Leader Unit
    case "LOF_004"://Kanan Jarrus (LOF) Leader Unit
    case "SOR_011"://Grand Inquisitor Leader Unit
        return !LeaderAbilitiesIgnored();
    //Spark of Rebellion
    case "SOR_207"://Crafty Smuggler
    case "SOR_064"://Wilderness Fighter
    case "SOR_180"://Seventh Fleet Defender
    case "SOR_068"://Cargo Juggernaut
    case "SOR_050"://The Ghost
    case "SOR_038"://Count Dooku (Darth Tyranus)
    case "SOR_085"://Rukh
    case "SOR_185"://Chimaera
    case "SOR_177"://Bib Fortuna
      return true;
    //Shadows of the Galaxy
    case "SHD_185"://Doctor Evazan
    case "SHD_043"://Village Protectors
    case "SHD_031"://The Client
    case "SHD_045"://Rose Tico
    case "SHD_192"://Dryden Vos
    case "SHD_240"://Hutt's Henchman
    case "SHD_034"://Supercommando Squad
      return true;
    //Jump to Lightspeed
    case "JTL_032"://Director Krennic
    case "JTL_242"://Shuttle ST-149
    case "JTL_054"://Gold Leader
    case "JTL_009"://Boba Fett
    case "JTL_036"://Iden Versio
    case "JTL_190"://Techno Union Transport
    case "JTL_065"://Outer Rim Outlaws
    case "JTL_056"://Hondo Ohnaka
      return true;
    //Legends of the Force
    case "LOF_190"://Anakin Skywalker Child LOF
    case "LOF_231"://Darth Tyranus
    case "LOF_183"://Shin Hati
    case "LOF_048"://Itinerant Warrior
    case "LOF_073"://Mythosaur
    case "LOF_247"://Gungan Warrior
    case "LOF_061"://Secretive Sage
    case "LOF_062"://Axe Woves
    case "LOF_214"://Sorcerers of Tund
    case "LOF_014"://Grand Inquisitor (deployed leader) — Shielded
      return true;

    case "LAW_038"://Lepi Lookout
    case "LAW_042"://IG-88
    case "LAW_118"://Droid Laser Turret
    case "LAW_122"://Shielded Hauler
    case "LAW_211"://Black Sun Patroller
    case "ASH_029"://Scorpenek Annihilator Droid
    case "ASH_048"://Imperial Armored Commando
    case "ASH_069"://Noti Nomad
    case "ASH_193"://Emperor's Champion
    case "ASH_208"://Sabine Wren (I Learned the Hard Way)
    case "ASH_243"://Darth Vader (Meet Your Destiny)
    case "ASH_T01"://Mandalorian token
      return true;

    default: break;
  }
  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId !== "0" && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId
        && HasShielded("JTL_053", theGhostPlayId, player))
      return true;
  }

  return false;
}
