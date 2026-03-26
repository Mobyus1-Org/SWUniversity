import { GetCardInPlay } from "../core-functions";
import { PlayerId } from "../core-models";
import { HasAmbush } from "./keyword-dictionaries.ts/ambush";
import { CountBounties } from "./keyword-dictionaries.ts/bounty";
import { HasCoordinate } from "./keyword-dictionaries.ts/coordinate";
import { HasGrit } from "./keyword-dictionaries.ts/grit";
import { HasHidden } from "./keyword-dictionaries.ts/hidden";
import { PilotingCost } from "./keyword-dictionaries.ts/piloting";
import { HasPlot } from "./keyword-dictionaries.ts/plot";
import { RestoreAmount } from "./keyword-dictionaries.ts/restore";
import { HasSaboteur } from "./keyword-dictionaries.ts/saboteur";
import { HasSentinel } from "./keyword-dictionaries.ts/sentinel";
import { HasShielded } from "./keyword-dictionaries.ts/shielded";
import { ExploitAmount } from "./keyword-dictionaries.ts/TODO_exploit";
import { HasOverwhelm } from "./keyword-dictionaries.ts/overwhelm";
import { RaidAmount } from "./keyword-dictionaries.ts/TODO_raid";
import { SmuggleCost } from "./keyword-dictionaries.ts/TODO_smuggle";

export function HasKeyword(cardId: string, keyword: string, playId?: string, player?: PlayerId)
{
  if(playId) {
    const cardInPlay = GetCardInPlay(playId, player);
    if(!cardInPlay) {
      return false;
    }
    if(cardId !== cardInPlay.cardId) {
      return false;
    }
  }

  switch(keyword) {
    case "Sentinel":
      return HasSentinel(cardId, playId, player);
    case "Grit":
      return HasGrit(cardId, playId, player);
    case "Bounty":
      return CountBounties(cardId, playId, player) > 0;
    case "Coordinate":
      return HasCoordinate(cardId, playId, player);
    case "Overwhelm":
      return HasOverwhelm(cardId, playId, player);
    case "Ambush":
      return HasAmbush(cardId, playId, undefined, player);
    case "Shielded":
      return HasShielded(cardId, playId, player);
    case "Saboteur":
      return HasSaboteur(cardId, playId, player);
    case "Hidden":
      return HasHidden(cardId, playId, player);
    case "Plot":
      return HasPlot(cardId, playId, player);
    case "Raid":
      return RaidAmount(cardId, playId, player) > 0;
    case "Restore":
      return RestoreAmount(cardId, playId, player) > 0;
    case "Smuggle":
      return SmuggleCost(cardId, playId, player) > -1;
    case "Exploit":
      return ExploitAmount(cardId, playId, player) > 0;
    case "Piloting":
      return PilotingCost(cardId) >= 0;
    case "Any":
      return HasSentinel(cardId, playId, player) ||
        HasGrit(cardId, playId, player) ||
        HasCoordinate(cardId, playId, player) ||
        CountBounties(cardId, playId, player) > 0 ||
        HasOverwhelm(cardId, playId, player) ||
        HasAmbush(cardId, playId, undefined, player) ||
        HasShielded(cardId, playId, player) ||
        HasSaboteur(cardId, playId, player) ||
        HasHidden(cardId, playId, player) ||
        HasPlot(cardId, playId, player) ||
        RaidAmount(cardId, playId, player) > 0 ||
        RestoreAmount(cardId, playId, player) > 0 ||
        SmuggleCost(cardId, playId, player) > -1 ||
        ExploitAmount(cardId, playId, player) > 0 ||
        PilotingCost(cardId) >= 0;
    default:
      return false;
  }
}
