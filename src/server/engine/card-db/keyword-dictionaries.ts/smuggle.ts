import { GetResources, GetUnitsForPlayer } from "@/server/engine/core-functions";
import { PlayerId } from "@/lib/engine/core-models";
import { CardCost } from "@/server/engine/card-db/generated";

export function SmuggleCost(cardId: string, player?: PlayerId, playId?: string): number {
  let minCost = -1;
  switch(cardId) {
    case "SHD_065": minCost = 7; break;//Vigilant Pursuit Craft
    case "SHD_252": minCost = 3; break;//Smuggler's Aid
    case "SHD_149": minCost = 5; break;//Nite Owl Skirmisher
    case "SHD_113": minCost = 6; break;//Privateer Crew
    case "SHD_204": minCost = 6; break;//Millennium Falcon - Lando's Pride
    case "SHD_089": minCost = 7; break;//Pirate Battle Tank
    case "SHD_203": minCost = 6; break;//Zorii Bliss
    case "SHD_097": minCost = 4; break;//Freetown Backup
    case "SHD_160": minCost = 3; break;//Reckless Gunslinger
    case "SHD_174": minCost = 3; break;//Hotshot DL-44 Blaster
    case "SHD_248": minCost = 4; break;//Tech
    case "SHD_184": minCost = 4; break;//Bazine Netal
    case "SHD_075": minCost = 3; break;//Covert Strength
    case "SEC_088": minCost = 7; break;//First Light
    case "SHD_129": minCost = 2; break;//Timely Intervention
    case "SHD_032": minCost = 5; break;//Lom Pyke
    case "SHD_197": minCost = 4; break;//L3-37
    case "SHD_215": minCost = 4; break;//Smuggler's Starfighter
    case "SHD_086": minCost = 4; break;//Warbird Stowaway
    case "SHD_119": minCost = 5; break;//Weequay Pirate Gang
    case "SHD_111": minCost = 3; break;//Collections Starhopper
    case "SHD_148": minCost = 5; break;//Cassian Andor
    case "SHD_050": minCost = 9; break;//Chewbacca - Pykesbane
    case "SHD_052": minCost = 6; break;//Sugi
    case "SHD_201": minCost = 6; break;//Principled Outlaw
    case "SHD_175": minCost = 4; break;//Armed to the Teeth
    case "SHD_127": minCost = 3; break;//Commission
    case "SHD_213": minCost = 7; break;//DJ - Blatant Thief
    case "SHD_225": minCost = 4; break;//Jetpack
    case "SHD_107": minCost = 6; break;//Enterprising Lackeys
    case "SHD_217": minCost = 5; break;//Tobias Beckett
    default: break;
  }

  if (player && playId) {
    for(const u of GetUnitsForPlayer(player)) {
      switch(u.cardId) {
        case "SHD_248"://Tech
          if (!u.LostAbilities()) {
            const playIdIsFromResource = GetResources(player).some(r => r.playId === playId);
            if (playIdIsFromResource) {
              const cost = CardCost(cardId);
              if (minCost == -1 || minCost > cost) minCost = cost;
            }
          }
          break;
        default: break;
      }
    }
  }

  return minCost;
}