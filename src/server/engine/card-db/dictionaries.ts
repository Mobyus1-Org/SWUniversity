import { GetCardInPlay } from "@/server/engine/core-functions";
import { PlayerId } from "@/lib/engine/core-models";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { CountBounties } from "@/server/engine/card-db/keyword-dictionaries.ts/bounty";
import { HasCoordinate } from "@/server/engine/card-db/keyword-dictionaries.ts/coordinate";
import { HasGrit } from "@/server/engine/card-db/keyword-dictionaries.ts/grit";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { PilotingCost } from "@/server/engine/card-db/keyword-dictionaries.ts/piloting";
import { HasPlot } from "@/server/engine/card-db/keyword-dictionaries.ts/plot";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { ExploitAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/exploit";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { SmuggleCost } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";

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
      return SmuggleCost(cardId) > -1;
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
        SmuggleCost(cardId) > -1 ||
        ExploitAmount(cardId, playId, player) > 0 ||
        PilotingCost(cardId) >= 0;
    default:
      return false;
  }
}
