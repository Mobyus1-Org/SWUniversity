/**
 * When Attack Ends abilities — checked immediately after an attack resolves.
 * historically, some cards read this as "When this unit completes an attack" (meaning it survived post-combat)
 * or as "When this unit attacks and defeats a unit" (meaning the defender was defeated)
 * or even more conditional like "When this unit attacks and defeats a non-leader unit"
 * but starting with Set 7 (LAW), these read differently:
 * completes became "When Attack Ends: If this unit survived, ..."
 * defeats became "When Attack Ends: If the defending unit was defeated, ..."
 * and the more conditional ones became "When Attack Ends: If the defending unit was a non-leader and was defeated, ..."
 * so we can check all of these with the same function and just have different conditions inside to better align with the new wording.
 */
export function HasWhenAttackEnds(cardId: string): boolean {
  switch (cardId) {
    case "SOR_009": //Leia Organa "When this unit completes an attack: You may attack with another Rebel unit."
      return true;
    case "SEC_006": //Colonel Yularen "When this unit completes an attack (and survives): You may attack with another unit that costs 4 or less."
      return true;
    case "SOR_015": //Boba Fett "When this unit completes an attack: If an enemy unit left play this phase, ready up to 2 resources."
      return true;
    case "ASH_033": //Grand Admiral Thrawn — if the defending unit was defeated, ready this unit
    case "ASH_036": //Rukh — if the defending unit was defeated, may give 3 Advantage tokens to a unit
    case "ASH_101": //The Great Mothers — defeat the non-leader units this unit dealt combat damage to
    case "ASH_223": //Halo — if the defending unit was defeated, give a Shield token to this unit
      return true;
    case "LOF_016": //Qui-Gon Jinn — completes an attack (and survives): may return a unit and play a cheaper non-Villainy unit free
      return true;
    default: return false;
  }
}