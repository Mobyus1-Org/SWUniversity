import { PlayerId } from "@/lib/engine/core-models";
import { AllUnits, AttackedThisPhasePlayIds, CanDiscloseAnyOf, CardIsLeader, GetGame, GetHand, GetResources, GetUnitInPlay, GetUnitsForPlayer, HasTheForce, IsCoordinateActive, LeaderAbilitiesIgnored, PlayerHasCardsToSmuggle, PlayerHasUnitsInHand, SEC_004_ASPECTS, TraitContains } from "@/server/engine/core-functions";
import { Unit } from "@/server/engine/unit";
import { CardTraits, CardCost, CardType } from "@/server/engine/card-db/generated";
import { SharesKeyword } from "@/server/engine/card-db/keyword-dictionaries.ts/all-keywords";
import { PilotlessVehiclePlayIds } from "@/server/engine/card-db/upgrade-attach-restrictions";

/**
 * Every unit (either side) whose power is below that of at least one unit `player` controls —
 * the legal targets for ASH_009 Ahsoka Tano's "choose a unit with less power than a friendly unit".
 */
export function WeakerThanAFriendlyUnitPlayIds(player: PlayerId): string[] {
  const friendlyPowers = GetUnitsForPlayer(player).map(u => Unit.FromInterface(u).CurrentPower());
  if (friendlyPowers.length === 0) return [];
  const strongestFriendly = Math.max(...friendlyPowers);
  return AllUnits()
    .filter(u => Unit.FromInterface(u).CurrentPower() < strongestFriendly)
    .map(u => u.playId);
}

export function ActionAbilities(cardId: string, player: PlayerId, playId?: string): string[] {
  const game = GetGame();
  if (!game) throw new Error("Game not found in ActionAbilities");
  const leader = player === 1
    ? game.currentGameState.player1.leader
    : game.currentGameState.player2.leader;
  const abilities: string[] = [];

  if (!leader.deployed && leader.ready && !LeaderAbilitiesIgnored() ) {
    //Leader side abilities that don't require conditions
    switch (cardId) {
      case "SOR_002": //Iden Versio - Inferno Squad Commander
      case "SOR_003": //Chewbacca - Walking Carpet
      case "SOR_004": //Chirrut Îmwe - One With The Force
      case "SOR_005": //Luke Skywalker - Faithful Friend
      case "SOR_007": //Grand Moff Tarkin - Ruthless Strategist
      case "SOR_009": //Leia Organa - Alliance General
      case "SOR_010": //Darth Vader - Dark Lord of the Sith
      case "SOR_011": //Grand Inquisitor - Hunting the Jedi
      case "SOR_012": //IG-88 - Ruthless Bounty Hunter
      case "SOR_013": //Cassian Andor - Dedicated to the Rebellion
      case "SOR_014": //Sabine Wren - Galvanized Revolutionary
      case "SOR_016": //Grand Admiral Thrawn - Patient and Insightful
      case "SOR_017": //Han Solo - Audacious Smuggler
      case "SOR_018": //Jyn Erso - Resisting Oppression
      case "SHD_002": //Qi'Ra - I Alone Survived
      case "SHD_003": //Finn - This is a Rescue
      case "SHD_004": //Rey - More Than a Scavenger
      case "SHD_006": //Jabba the Hutt - His High Exaltedness
      case "SHD_007": //Moff Gideon - Formidable Commander
      case "SHD_009": //Hunter - Outcast Sergeant
      case "SHD_010": //Bossk - Hunting His Prey
      case "SEC_015": //C-3PO - Human-Cyborg Relations: Action [1 resource, Exhaust]: if you control an exhausted unit, exhaust a unit. (Soft-passes if the condition isn't met.)
      case "SHD_012": //Bo-Katan Kryze - Princess in Exile
      case "SHD_013": //Han Solo - Worth the Risk
      case "SHD_016": //Fennec Shand - Honoring the Deal
      case "SHD_017": //Lando Calrissian - With Impeccable Taste
        abilities.push(cardId);
        break;
      case "TWI_005": // Count Dooku — needs Separatist card in hand
        if (GetHand(player).some(c => CardTraits(c.cardId).includes("Separatist"))) abilities.push(cardId);
        break;
      case "LAW_008": // Director Krennic — Action [Exhaust, defeat a friendly unit]: Create a Credit token (needs a friendly unit to defeat).
        if (GetUnitsForPlayer(player).length > 0) abilities.push(cardId);
        break;
      case "LAW_013": // Chewbacca — Action [1 resource, Exhaust, defeat a friendly resource]: 2 damage to a unit + Credit token.
        // Needs a resource to defeat on top of the 1 paid (the paid one may itself be defeated).
        if (GetResources(player).length > 0) abilities.push(cardId);
        break;
      case "LOF_007": // Avar Kriss — Action [Exhaust]: The Force is with you (create your Force token).
        abilities.push(cardId);
        break;
      case "LOF_005": { // Morgan Elsbeth — Action [Exhaust]: Choose a friendly unit that attacked this
                        // phase; play a hand unit that shares a keyword with it at -1.
        const attacked005 = AttackedThisPhasePlayIds({ player });
        const handUnits005 = GetHand(player).filter(c => CardType(c.cardId) === "Unit");
        const canShare005 = attacked005.some(pid => {
          const u = AllUnits().find(x => x.playId === pid);
          return u && handUnits005.some(h => SharesKeyword(h.cardId, u.cardId, {}, { player, playId: pid }));
        });
        if (canShare005) abilities.push(cardId);
        break;
      }
      case "TWI_007": // Captain Rex — Action [2 resources, Exhaust]: create a Clone Trooper if a friendly unit attacked.
        abilities.push(cardId);
        break;
      case "TWI_004": // Yoda — Action [Exhaust]: draw + top/bottom, if a unit left play this phase.
        abilities.push(cardId);
        break;
      case "TWI_002": // Nute Gunray — Action [Exhaust]: create a Battle Droid if 2+ units defeated this phase (soft-pass condition, not a cost gate).
      case "TWI_006": // Wat Tambor — Action [Exhaust]: if a friendly unit was defeated this phase, give a unit +2/+2 (soft-pass condition).
        abilities.push(cardId);
        break;
      case "JTL_012": // Luke Skywalker — Action [Exhaust]: 1 damage to a unit, if a Fighter attacked this phase.
      case "JTL_010": // Captain Phasma — Action [Exhaust]: 1 damage to a base, if you played a First Order card this phase (soft-pass condition).
      case "LOF_012": // Rey — Action [Exhaust]: 1 damage to a unit, if you played a non-unit Force card this phase (soft-pass condition).
        abilities.push(cardId);
        break;
      case "JTL_004": // Rose Tico — Action [Exhaust]: Heal 2 from a Vehicle unit that attacked this phase.
        if (AttackedThisPhasePlayIds({ trait: "Vehicle" }).length > 0) abilities.push(cardId);
        break;
      case "JTL_005": // Admiral Piett — Action [Exhaust]: Play a Capital Ship unit from hand at -1.
        if (PlayerHasUnitsInHand(player, { trait: "Capital Ship" })) abilities.push(cardId);
        break;
      case "JTL_014": // Admiral Trench — Action [Exhaust]: Discard a card that costs 3+ from hand, then draw.
        if (GetHand(player).some(c => (CardCost(c.cardId) ?? 0) >= 3)) abilities.push(cardId);
        break;
      case "JTL_018": // Kazuda Xiono — Action [Exhaust]: a friendly unit loses all abilities this round (needs a unit to target).
        if (GetUnitsForPlayer(player).length > 0) abilities.push(cardId);
        break;
      case "LOF_003": // Ahsoka Tano — Action [Exhaust, use the Force]: Give a friendly unit Sentinel (needs the Force + a friendly unit).
        if (HasTheForce(player) && GetUnitsForPlayer(player).length > 0) abilities.push(cardId);
        break;
      case "LOF_009": // Darth Maul — Action [Exhaust, use the Force]: 1 damage to a unit + 1 to a different unit (needs the Force + a unit).
        if (HasTheForce(player) && AllUnits().length > 0) abilities.push(cardId);
        break;
      case "LOF_014": // Grand Inquisitor — Action [Exhaust, use the Force]: Attack with a friendly unit (needs the Force + a ready unit).
        if (HasTheForce(player) && GetUnitsForPlayer(player).some(u => u.ready)) abilities.push(cardId);
        break;
      case "LOF_015": // Cal Kestis — Action [Exhaust, use the Force]: opponent exhausts a ready unit (needs the Force + an enemy ready unit).
        if (HasTheForce(player) && GetUnitsForPlayer(player === 1 ? 2 : 1).some(u => u.ready)) abilities.push(cardId);
        break;
      case "LOF_016": // Qui-Gon Jinn — Action [Exhaust, use the Force]: return a friendly non-leader unit (needs the Force + a friendly non-leader unit).
        if (HasTheForce(player) && GetUnitsForPlayer(player).some(u => !CardIsLeader(u.cardId))) abilities.push(cardId);
        break;
      case "SEC_004": // Leia Organa (SEC) — Action [1 resource, Exhaust]: disclose, then give an XP token.
        if (CanDiscloseAnyOf(player, SEC_004_ASPECTS)) abilities.push(cardId);
        break;
      case "LAW_010": // Leia Organa (LAW) — Action [2 resources, Exhaust]: give a unit +1/+1 per different aspect.
        if (GetUnitsForPlayer(1).concat(GetUnitsForPlayer(2)).length > 0) abilities.push(cardId);
        break;
      case "ASH_009": // Ahsoka Tano — Action [Exhaust]: Choose a unit with less power than a friendly
                      // unit. It gets +2/+0 for this phase.
        if (WeakerThanAFriendlyUnitPlayIds(player).length > 0) {
          abilities.push(cardId);
        }
        break;
      case "LOF_002": // Mother Talzin — Action [Exhaust, use the Force]: Give a unit -1/-1 this phase.
        if (HasTheForce(player) && GetUnitsForPlayer(1).concat(GetUnitsForPlayer(2)).length > 0) {
          abilities.push(cardId);
        }
        break;
      case "JTL_013": { // Poe Dameron — Action [1 resource, Exhaust]: Flip this leader and attach him
                        // as an upgrade to a friendly Vehicle unit WITHOUT a Pilot on it.
        const game013 = GetGame();
        if (game013 && PilotlessVehiclePlayIds(game013.currentGameState, player).length > 0) {
          abilities.push(cardId);
        }
        break;
      }
      //needs conditions met
      case "SOR_006": //Emperor Palpatine - Galactic Ruler
        if (GetUnitsForPlayer(player).length > 0) abilities.push(cardId);
        break;
      case "TWI_012": // Anakin Skywalker — Action: Attack with a unit (needs a ready unit)
      case "TWI_014": // Asajj Ventress — Action: Attack with a unit; +1/+0 if an event was played (needs a ready unit)
        if (GetUnitsForPlayer(player).some(u => u.ready)) abilities.push(cardId);
        break;
      case "TWI_011": // Ahsoka Tano — Coordinate: gains the Action only while controlling 3+ units.
        if (IsCoordinateActive(player) && GetUnitsForPlayer(player).some(u => u.ready)) abilities.push(cardId);
        break;
      case "SEC_006": // Colonel Yularen — Action [Exhaust]: Attack with a unit, then optionally a cheaper one (needs a ready unit)
        if (GetUnitsForPlayer(player).some(u => u.ready)) abilities.push(cardId);
        break;
      case "SHD_011": //Kylo Ren - Rash and Deadly
        if (GetHand(player).length > 0) abilities.push(cardId);
        break;
      default: break;
     }
  }

  if (playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) throw new Error("Unit not found for given playId and player in ActionAbilities");
    if(unit.LostAbilities()) return abilities;

    switch (cardId) {
      case "SHD_006": //Jabba the Hutt - His High Exaltedness
        abilities.push(cardId);
        break;
      case "SHD_013": //Han Solo - Worth the Risk
        if (PlayerHasUnitsInHand(player)) {
          abilities.push(cardId);
        }
        break;
      case "SHD_016": //Fennec Shand - Honoring the Deal
        if (PlayerHasUnitsInHand(player, { maxCost: 4 })) {
          abilities.push(cardId);
        }
        break;
      case "SHD_017": //Lando Calrissian - With Impeccable Taste
        if (PlayerHasCardsToSmuggle(player)) {
          abilities.push(cardId);
        }
        break;
      case "LOF_013": //Barriss Offee - We Have Become Villains
      case "LOF_018": //Anaking Skywalker - Tempted by the Dark Side
        if (HasTheForce(player)) {
          abilities.push(cardId);
        }
        break;
      case "SEC_007": //Dryden Vos - I Never Ask Twice
        if (GetHand(player).length > 0) {
          abilities.push(cardId);
        }
        break;
      case "LAW_003": //Agent Kallus - Reconsider Your Allegiance
        if (GetResources(player, true).length > 0) {
          abilities.push(cardId);
        }
        break;
      case "SHD_028": { // Doctor Pershing — Action [Exhaust, deal 1 damage to a friendly unit]: Draw a card.
        const friendlyUnits028 = GetUnitsForPlayer(player);
        if (friendlyUnits028.length > 0) {
          abilities.push(cardId);
        }
        break;
      }
      case "LOF_246": // Grogu — Action [Exhaust]: Heal up to 2 from a unit; if healed, deal that to a unit.
        abilities.push(cardId);
        break;
      case "LOF_206": // Babu Frik — Action [Exhaust]: attack with a friendly Droid unit (deals HP as damage).
        if (GetUnitsForPlayer(player, true).some(u => u.playId !== playId && TraitContains(u.cardId, "Droid", player, u.playId))) {
          abilities.push(cardId);
        }
        break;
      case "SOR_093": // Alliance Dispatcher — Action [Exhaust]: Play a unit from hand at -1 cost.
        if (PlayerHasUnitsInHand(player)) abilities.push(cardId);
        break;
      case "SOR_094": { // Bail Organa — Action [Exhaust]: Give an Experience token to another friendly unit.
        const others094 = GetUnitsForPlayer(player).filter(u => u.playId !== playId);
        if (others094.length > 0) abilities.push(cardId);
        break;
      }
      case "SOR_110": // Frontline Shuttle — Action [defeat this unit]: Attack with a unit, even if exhausted.
        abilities.push(cardId);
        break;
      case "SOR_129": // Admiral Ozzel — Action [exhaust]: Play an Imperial unit from hand.
        if (PlayerHasUnitsInHand(player, { trait: "Imperial" })) abilities.push(cardId);
        break;
      default: break;
    }
  }

  return abilities;
}

export function ActionAbilityCost(cardId: string): number {
  switch (cardId) {
    //Leader abilities
    case "LAW_010"://Leia Organa - Someone Who Loves You
      return 2;
    case "SEC_004"://Leia Organa - Of A Secret Bloodline
      return 1;
    case "SEC_015"://C-3PO - Human-Cyborg Relations
      return 1;
    case "SOR_005"://Luke Skywalker
      return 1;
    case "SOR_007"://Grand Moff Tarkin
      return 1;
    case "SOR_013"://Cassian Andor
      return 1;
    case "SOR_006"://Emperor Palpatine
      return 1;
    case "LAW_013"://Chewbacca - Hero of Kessel
      return 1;
    case "SOR_010"://Darth Vader
      return 1;
    case "SOR_016"://Grand Admiral Thrawn
      return 1;
    case "SHD_002"://Qi'Ra
      return 1;
    case "SHD_004"://Rey
      return 1;
    case "SHD_016"://Fennec Shand - Honoring the Deal
      return 1;
    case "SHD_009"://Hunter - Outcast Sergeant
      return 1;
    case "TWI_010"://Pre Viszla
      return 1;
    case "TWI_013"://Mace Windu
      return 1;
    case "TWI_007"://Captain Rex
      return 2;
    case "TWI_008"://Padme Amidala
      return 1;
    case "JTL_003"://Lando Calrissian
      return 1;
    case "JTL_016"://Admiral Ackbar - It's a Trap!
      return 1;
    case "JTL_015"://Rio Durant
      return 1;
    case "JTL_007"://Admiral Holdo
      return 1;
    case "JTL_013"://Poe Dameron
      return 1;
    case "JTL_014-D"://Admiral Trench
      return 3;
    case "LOF_004"://Kanan Jarrus Leader
      return 1;
    case "LOF_011"://Kit Fisto Leader
      return 1;
    case "LOF_006"://Supreme Leader Snoke
      return 1;
    case "IBH_053"://Darth Vader - Don't Fail Me Again
      return 1;
    case "IBH_001"://Leia Organa - Get To Your Transports!
      return 1;
    case "SEC_001"://Chancellor Palpatine
      return 1;
    case "SEC_014"://Sly Moore
      return 1;
    case "SEC_010"://Dedra Meero
      return 1;
    //unit abilities
    case "SOR_184"://Fett's Firespray
      return 2;
    case "TWI_194"://Ahsoka Tano TWI
      return 2;
    case "SHD_087-1"://Crosshair
      return 2;
      case "SHD_256"://Mercenary Gunship
      return 4;
    case "TWI_105"://Steadfast Senator
      return 2;
    case "TWI_157"://Disaffected Senator
      return 2;
    case "TWI_056"://Compassionate Senator
      return 2;
    case "TWI_206"://Independent Senator
      return 2;
    case "JTL_050"://Phantom II
      return 1;
    //from upgrades
    case "SHD_155": return 2; //Heroic Resolve
    default: return 0;
  }
}
