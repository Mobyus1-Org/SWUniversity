import { GetUnitInPlay } from "../../core-functions";
import { PlayerId } from "../../core-models";

export function CountBounties(cardId: string, playId?: string, player?: PlayerId): number
{
  let bounties = 0;
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in HasBounty");
    if (unit.LostAbilities()) return 0;
    //conditional bounty
    switch (cardId) {
      case "SHD_033"://Synara San - Loyal To Kragan
      case "SHD_165"://Unlicensed Headhunter
        bounties += !unit.ready ? 1 : 0;
        break;
      default: break;
    }

    bounties += unit.HasBounty() ? 1 : 0;
  }

  switch (cardId) {
    case "SHD_125"://Price on Your Head
    case "SHD_173"://Guild Target
    case "SHD_221"://Wanted
    case "SHD_071"://Top Target
    case "SHD_261"://Rich Reward
    case "SHD_068"://Public Enemy
    case "SHD_185"://Doctor Evazan
    case "SHD_222"://Enticing Reward
    case "SHD_095"://Clone Deserter
    case "SHD_195"://Cartel Turncoat
    case "SHD_027"://Hylobon Enforcer
    case "SHD_134"://Guavian Antagonizer
    case "SHD_167"://Wanted Insurgents
    case "SHD_116"://Outlaw Corona
    case "SHD_211"://Fugitive Wookie
    case "SHD_161"://Stolen Landspeeder
    case "SHD_226"://Unrefusable Offer
    case "SHD_123"://Bounty Hunter's Quarry
    case "SHD_176"://Death Mark
    case "SHD_058"://Val
      bounties += 1;
  }

  return bounties;
}