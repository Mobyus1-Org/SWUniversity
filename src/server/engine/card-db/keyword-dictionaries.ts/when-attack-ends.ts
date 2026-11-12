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
    case "ASH_001": //The Armorer (deployed) — may play an upgrade from resources on a friendly unit
    case "ASH_033": //Grand Admiral Thrawn — if the defending unit was defeated, ready this unit
    case "ASH_036": //Rukh — if the defending unit was defeated, may give 3 Advantage tokens to a unit
    case "ASH_101": //The Great Mothers — defeat the non-leader units this unit dealt combat damage to
    case "ASH_223": //Halo — if the defending unit was defeated, give a Shield token to this unit
      return true;
    case "LAW_034": //Chewbacca — if the defending unit was defeated, give him an XP token and heal 3
      return true;
    case "IC27_146": //Boba Fett (Compensated If He Dies) — if the defending unit was defeated, may ready 2 resources
    case "IC27_158": //Millennium Falcon (Ya-Hoo!) — may pay 1: return a friendly unit costing 3 or less, replay it free
      return true;
    case "SEC_048": //Captain Rex — completes an attack: give this unit and an enemy unit Sentinel
      return true;
    case "LOF_016": //Qui-Gon Jinn — completes an attack (and survives): may return a unit and play a cheaper non-Villainy unit free
      return true;
    case "TS26_04": //Padmé Amidala (deployed) — may attack with another friendly unit that entered play this phase
    case "LAW_001": //Saw Gerrera (deployed) — if he survived, may attack with another unit (+2/+0, Overwhelm, then defeat it)
    case "SEC_003": //Lama Su (deployed) — completes an attack: may play an upgrade from discard on a non-Vehicle unit, 1 less
    case "TS26_08": //Ahsoka Tano (deployed) — look at the top card: play it for 1 less, discard it, or leave it (even if she died)
      return true;
    default: return false;
  }
}