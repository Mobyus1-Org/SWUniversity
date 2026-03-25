import { PlayerId } from "../../core-models";

export function RaidAmount(cardId: string, playId?: string, player?: PlayerId)
{
  //... will stack Raid amounts based on the unique playId. searches for the unit and gets its cardId to check plus any upgrades or effects that might give Raid as well; else returns 0;
  let amount = 0;
   //placeholder to prevent unused variable errors, will be removed when actual implementation is done
  amount += cardId.length + (playId?.length || 0) + (player || 0);

  return amount;
}