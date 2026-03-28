import { PlayerId } from "@/lib/engine/core-models";
import { GetGame, GetHand, GetResources, GetUnitInPlay, GetUnitsForPlayer, HasTheForce, LeaderAbilitiesIgnored, PlayerHasCardsToSmuggle, PlayerHasUnitsInHand } from "@/server/engine/core-functions";

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
      case "SHD_012": //Bo-Katan Kryze - Princess in Exile
      case "SHD_013": //Han Solo - Worth the Risk
      case "SHD_016": //Fennec Shand - Honoring the Deal
      case "SHD_017": //Lando Calrissian - With Impeccable Taste
        abilities.push(cardId);
        break;
      //needs conditions met
      case "SOR_006": //Emperor Palpatine - Galactic Ruler
        if (GetUnitsForPlayer(player).length > 0) abilities.push(cardId);
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
      default: break;
    }
  }

  return abilities;
}

export function ActionAbilityCost(cardId: string): number {
  switch (cardId) {
    //Leader abilities
    case "SOR_005"://Luke Skywalker
      return 1;
    case "SOR_007"://Grand Moff Tarkin
      return 1;
    case "SOR_013"://Cassian Andor
      return 1;
    case "SOR_006"://Emperor Palpatine
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
