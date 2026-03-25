import { GetUnitInPlay } from "../../core-functions";
import { PlayerId } from "../../core-models";

export function HasPlot(cardId: string, playId?: string, player?: PlayerId)
{
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasPlot");
    if (unit.LostAbilities()) return false;
  }

  switch(cardId) {
    //Secrets of Power
    case "SEC_033"://Sly Moore (SEC)
    case "SEC_034"://Cad Bane (SEC)
    case "SEC_036"://Dogmatic Shock Squad
    case "SEC_070"://Armor of Fortune
    case "SEC_082"://Chancellor Palpatine unit (SEC)
    case "SEC_084"://Mas Amedda (SEC)
    case "SEC_099"://Naboo Royal Starship
    case "SEC_111"://Jar Jar Binks (SEC)
    case "SEC_123"://Unveiled Might
    case "SEC_149"://Kaydel Connix
    case "SEC_183"://Topple the Summit
    case "SEC_226"://Sneaking Suspicion
      return true;
    default: return false;
  }
}