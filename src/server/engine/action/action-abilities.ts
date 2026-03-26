import { CardCost, CardType } from "../card-db/generated";
import { SmuggleCost } from "../card-db/keyword-dictionaries.ts/TODO_smuggle";
import { GetHand, GetResources, GetUnitsForPlayer, HasTheForce, IsCoordinateActive, TraitContains } from "../core-functions";
import { PlayerId } from "../core-models";
import { ActionAbilityContext, GameEffect, TriggerEntry } from "../trigger-types";

// ---------------------------------------------------------------------------
// Dictionaries
// ---------------------------------------------------------------------------
//
// Leaders have two sides that are tracked independently:
//   leaderSide     — the non-deployed leader card (e.g. Action [Exhaust]: ...)
//   leaderUnitSide — the deployed leader unit (may have a different or no ability); leader unit side Action abilities do not exhaust the leader unit card itself
//
// Non-leader units with action abilities use cardHasActionAbility.
// ---------------------------------------------------------------------------

/** Leader card's non-deployed side action ability. */
const leaderSideHasActionAbility: Record<string, boolean> = {
  "SOR_002": true, // Iden Versio - Inferno Squad Commander
  "SOR_003": true, // Chewbacca - Walking Carpet
  "SOR_004": true, // Chirrut Îmwe - One With The Force
  "SOR_005": true, // Luke Skywalker - Faithful Friend
  "SOR_007": true, // Grand Moff Tarkin - Oversector Governor
  "SOR_009": true, // Leia Organa - Alliance General
  "SOR_010": true, // Darth Vader - Dark Lord of the Sith
  "SOR_011": true, // Grand Inquisitor - Hunting The Jedi
  "SOR_012": true, // IG-88 - Ruthless Bounty Hunter
  "SOR_013": true, // Cassian Andor - Dedicated to the Rebellion
  "SOR_014": true, // Sabine Wren - Galvanized Revolutionary
  "SOR_016": true, // Grand Admiral Thrawn - Patient and Insightful
  "SOR_017": true, // Han Solo - Audacious Smuggler
  "SOR_018": true, // Jyn Erso - Resisting Oppression
  "SHD_002": true, // Qi'Ra - I Alone Survived
  "SHD_003": true, // Finn - This Is A Rescue
  "SHD_004": true, // Rey - More Than A Scavenger
  "SHD_006": true, // Jabba the Hutt - His High Exaltedness
  "SHD_007": true, // Moff Gideon - Formidable Commander
  "SHD_009": true, // Hunter - Outcast Sergeant
  "SHD_010": true, // Bossk - Hunting His Prey
  "SHD_012": true, // Bo-Katan Kryze - Princess In Exile
  "SHD_013": true, // Han Solo - Worth the Risk
  "SHD_016": true, // Fennec Shand - Honoring the Deal
  "SHD_017": true, // Lando Calrissian - With Impeccable Taste
  "TWI_002": true, // Nute Gunray - Vindictive Viceroy
  "TWI_003": true, // Obi-Wan Kenobi - Patient Mentor
  "TWI_004": true, // Yoda - Sensing Darkness
  "TWI_005": true, // Count Dooku - Face of the Confederacy
  "TWI_006": true, // Wat Tambor - Techno Union Foreman
  "TWI_007": true, // Captain Rex - Fighting for his Brothers
  "TWI_009": true, // Maul - A Rival in Darkness
  "TWI_010": true, // Pre Vizsla - Pursuing the Throne
  "TWI_012": true, // Anakin Skywalker - What It Takes To Win
  "TWI_013": true, // Mace Windu - Vaapad Form Master
  "TWI_014": true, // Asajj Ventress - Unparalleled Adversary
  "TWI_015": true, // General Grievous - General of the Droid Armies
  "TWI_017": true, // Chancellor Palpatine - Playing Both Sides & Darth Sidious - Playing Both Sides
};

/** Leader card's deployed unit side action ability. Can be used when exhausted as well */
const leaderUnitSideHasActionAbility: Record<string, boolean> = {
  "LAW_003": true, // Agent Kallus - Reconsider Your Allegiance
};

/** Non-leader unit cards with an action ability (uncommon). */
const cardHasActionAbility: Record<string, boolean> = {
  // TODO: populate as unit abilities are implemented
};

/** Resource cost for the leader side ability. 0 = exhaust-only. */
const leaderSideActionAbilityCost: Record<string, number> = {
  "SOR_005": 1, // Luke Skywalker - Faithful Friend
  "SOR_006": 1, // Emperor Palpatine - Galactic Ruler
  "SOR_007": 1, // Grand Moff Tarkin - Oversector Governor
  "SOR_010": 1, // Darth Vader - Dark Lord of the Sith
  "SOR_013": 1, // Cassian Andor - Dedicated to the Rebellion
  "SOR_016": 1, // Grand Admiral Thrawn - Patient and Insightful
  "SHD_002": 1, // Qi'Ra - I Alone Survived
  "SHD_004": 1, // Rey - More Than A Scavenger
  "SHD_009": 1, // Hunter - Outcast Sergeant
  "SHD_016": 1, // Fennec Shand - Honoring the Deal
  "TWI_007": 2, // Captain Rex - Fighting for his Brothers
  "TWI_008": 1, // Padmé Amidala - Serving the Republic
  "TWI_010": 1, // Pre Vizsla - Pursuing the Throne
  "TWI_013": 1, // Mace Windu - Vaapad Form Master
  "LAW_003": 1, // Agent Kallus - Reconsider Your Allegiance
};

/** Resource cost for the leader unit side ability. Does not exhaust the leader unit card. */
const leaderUnitSideActionAbilityCost: Record<string, number> = {
  "LAW_003": 1, // Agent Kallus - Reconsider Your Allegiance
};

/** Resource cost for a non-leader unit's action ability. 0 = exhaust-only. */
const cardActionAbilityCost: Record<string, number> = {
  // TODO:
};

export function HasLeaderSideActionAbility(cardId: string, player: PlayerId): boolean {
  //special cases
  switch (cardId) {
    case "SOR_006": // Emperor Palpatine - Galactic Ruler
      return GetUnitsForPlayer(player).length > 0;
    case "SHD_011": // Kylo Ren - Rash and Deadly
      return GetHand(player).length > 0;
    case "TWI_008": // Padmé Amidala - Serving the Republic
      return IsCoordinateActive(player);
    case "TWI_011": // Ahsoka Tano - Snips
      return IsCoordinateActive(player);
    default: break;
  }

  return leaderSideHasActionAbility[cardId] === true;
}

export function HasLeaderUnitSideActionAbility(cardId: string, player: PlayerId): boolean {
  //special cases
  switch (cardId) {
    case "SHD_013": // Han Solo - Worth the Risk (unit side: "Action: Play a unit from your hand. It costs 1 Resource less. Deal 2 damage to it.")
      return GetHand(player).some(card => CardType(card.cardId) === "Unit");
    case "SHD_016": // Fennec Shand - Honoring the Deal (unit side: "Action: Play a unit that costs 4 or less from your hand (paying its cost). Give it Ambush for this phase.")
      return GetHand(player).some(card => CardType(card.cardId) === "Unit" && (CardCost(card.cardId) ?? 0) <= 4);
    case "SHD_017": // Lando Calrissian - With Impeccable Taste (unit side: "Action: Play a card using Smuggle. It costs 2 Resources less. Defeat a resource you own and control. Use this ability only once each round.")
      return GetResources(player).some(resource => SmuggleCost(resource.cardId) > 0);
    case "LOF_013": //Barriss Offee - We Have Become Villains ("Action [use the Force]: Play an event from your hand. It costs 1 Resource less.")
      return HasTheForce(player);
    case "LOF_018": //Anakin Skywalker - Tempted by the Dark Side ("Action [use the Force]: Play a Villainy non-unit card from your hand, ignoring its aspect penalties.")
      return HasTheForce(player);
    case "SEC_007": //Dryden Vos - I Never Ask Twice ("Action [discard a card from your hand]: Play a unit from your hand (paying its cost). It gains Ambush for this phase.")
      return GetHand(player).length > 0;
    case "LAW_015": //Jabba the Hutt - Crime Boss ("Action: Play an Underworld unit unit from your hand. If you defeated a Credit while paying its cost, that unit gains Ambush for this phase.")
      return GetHand(player).some(card => CardType(card.cardId) === "Unit" && TraitContains(card.cardId, "Underworld", player));

    default: break;
  }

  return leaderUnitSideHasActionAbility[cardId] === true;
}

export function HasCardActionAbility(cardId: string): boolean {
  return cardHasActionAbility[cardId] === true;
}

/** Resource cost for the leader's non-deployed side ability. 0 = exhaust-only. */
export function LeaderSideActionAbilityCost(cardId: string): number {
  return leaderSideActionAbilityCost[cardId] ?? 0;
}

/** Resource cost for the leader's deployed unit side ability. 0 = exhaust-only. */
export function LeaderUnitSideActionAbilityCost(cardId: string): number {
  return leaderUnitSideActionAbilityCost[cardId] ?? 0;
}

/** Resource cost for a non-leader unit's action ability. 0 = exhaust-only. */
export function CardActionAbilityCost(cardId: string): number {
  return cardActionAbilityCost[cardId] ?? 0;
}

// ---------------------------------------------------------------------------
// Trigger building
// Action abilities are player-initiated, not passive triggers. Build the
// TriggerEntry after verifying the cost is payable and the card is ready.
// ---------------------------------------------------------------------------

/**
 * Builds the TriggerEntry for an action ability activation.
 * Call after the cost has been paid (card exhausted, resources spent).
 *
 * @param deployed  Pass true when activating the leader's deployed unit side,
 *                  false for the non-deployed leader side or any unit card.
 */
export function BuildActionAbilityTrigger(
  cardId: string,
  playId: string,
  activatedByPlayer: PlayerId,
  deployed: boolean,
  abilityIndex = 0,
): TriggerEntry {
  const context: ActionAbilityContext = {
    type: "action-ability",
    activatedByPlayer,
    abilityIndex,
    deployed,
  };

  return {
    triggerId: `${playId}:action-ability:${deployed ? "unit" : "leader"}:${abilityIndex}`,
    triggerType: "action-ability",
    sourceCardId: cardId,
    sourcePlayId: playId,
    owner: activatedByPlayer,
    context,
  };
}

// ---------------------------------------------------------------------------
// Trigger resolution
// ---------------------------------------------------------------------------

export function ResolveActionAbilityTrigger(entry: TriggerEntry): GameEffect[] {
  const { deployed } = entry.context as ActionAbilityContext;
  return deployed ? resolveLeaderUnitSideAbility(entry) : resolveLeaderSideAbility(entry);
}

/** Leader non-deployed side: Action [Exhaust]: ... */
function resolveLeaderSideAbility(entry: TriggerEntry): GameEffect[] {
  // (entry.context as ActionAbilityContext).abilityIndex available when implementing
  switch (entry.sourceCardId) {
    // TODO: implement per-leader non-deployed side abilities
    // case "SOR_001": // Han Solo — Action [Exhaust]: deal 1 damage to a unit
    //   return [{ type: "no-op" }];
    default:
      return [{ type: "no-op" }];
  }
}

/** Leader deployed unit side: Action [Exhaust]: ... (may differ from leader side or be absent) */
function resolveLeaderUnitSideAbility(entry: TriggerEntry): GameEffect[] {
  // (entry.context as ActionAbilityContext).abilityIndex available when implementing
  switch (entry.sourceCardId) {
    // TODO: implement per-leader deployed unit side abilities
    default:
      return [{ type: "no-op" }];
  }
}
