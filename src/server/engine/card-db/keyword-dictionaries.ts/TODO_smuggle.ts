import { PlayerId } from "../../core-models";

export function SmuggleCost(cardId: string, playId?: string, player?: PlayerId)
{
  //... will check if unit has Smuggle and return its cost whether innate or by given current effect; else returns -1;
  let cost = -1;
  //placeholder to prevent unused variable errors, will be removed when actual implementation is done
  cost += cardId.length + (playId?.length || 0) + (player || 0);

  return cost;
}