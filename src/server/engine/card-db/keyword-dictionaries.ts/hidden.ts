import { GetCurrentEffectsForPlayer, GetPlayIdForUniqueUnitInPlay, GetUnitInPlay, GetUnitsForPlayer, LeaderAbilitiesIgnored, TraitContains } from "../../core-functions";
import { PlayerId } from "../../core-models";

export function HasHidden(cardId: string, playId?: string, player?: PlayerId, isRecursion = false)
{
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasHidden");
    if (unit.LostAbilities()) return false;

  for(const currentEffect of GetCurrentEffectsForPlayer(player)) {
    if(currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) continue;
    //Check if ongoing effects prevent hidden
    switch(currentEffect.cardId) {
    case "LOF_209": //Tusken Tracker
        return false;
      default: break;
    }
    //Check if ongoing effects grant hidden
    switch(currentEffect.cardId) {
      case "LOF_010"://Third Sister Leader
      case "LOF_225"://Three Lessons
        return true;
      default: break;
    }
  }
  //other allies that grant hidden
  const units = GetUnitsForPlayer(player);
  for(const u of units)
  {
    switch(u.cardId) {
      case "LOF_132"://Grand Inquisitor LOF
        if(TraitContains(u.cardId, "Inquisitor", player)) return true;
        break;
      default: break;
    }
  }
  //conditional hidden
  switch (cardId) {
    case "LOF_105"://Oppo Rancisis
      if(isRecursion) return false; //Prevent recursion
      for(const u of units) {
        if(u.cardId == cardId) continue;
        if(HasHidden(u.cardId, u.playId, player, true)) return true;
      }
      break;
    }
  }

  switch(cardId) {
    //Legends of the Force
    case "LOF_190"://Anakin Skywalker Child
    case "LOF_246"://Grogu
    case "LOF_161"://Tuk'ata
    case "LOF_228"://Forged Starfighter
    case "LOF_143"://Attuned Fyrnock
    case "LOF_154"://Witch of the Mist
    case "LOF_107"://Village Tender
    case "LOF_179"://Aurra Sing
    case "LOF_088"://Eye of Sion
    case "LOF_183"://Shin Hati
    case "LOF_185"://Baylan Skoll
    case "LOF_211"://Dooku
    case "LOF_191"://BD-1
    case "LOF_181"://Banking Clan Shuttle
    case "LOF_210"://Charging Phillak
    case "LOF_245"://Vupltex
    case "LOF_132"://Grand Inquisitor LOF
    case "LOF_159"://Jedi In Hiding
      return true;
    case "LOF_010"://Third Sister Leader Unit
      return !LeaderAbilitiesIgnored();

    //Secrets of Power
    case "SEC_201"://Anakin Skywalker
      return true;
    default: break;
  }

  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId
        && HasHidden("JTL_053", theGhostPlayId, player))
      return true;
  }

  return false;
}