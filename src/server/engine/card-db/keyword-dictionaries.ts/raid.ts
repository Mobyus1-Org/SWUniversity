import { PlayerId } from "@/lib/engine/core-models";
import type { GameState } from "@/lib/engine/game";
import { GetCurrentEffectsForPlayer, GetHand, GetLeaderForPlayer, GetPlayIdForUniqueUnitInPlay, GetUnitInPlay, GetUnitsForPlayer, IsCoordinateActive, LeaderAbilitiesIgnored, PlayerControlsCardWithTitle, PlayerHasTokenUnitInPlay, PlayerHasUnitWithAspectInPlay, PlayerHasUnitWithTraitInPlay, TraitContains , LeaderUnitWasDefeatedThisPhase, GetGame, GetPlayer } from "@/server/engine/core-functions";
import { CardAspects, CardCost } from "@/server/engine/card-db/generated";
import { Unit } from "@/server/engine/unit";
import { SupportGrantedCardId } from "@/server/engine/card-db/keyword-dictionaries.ts/support";

/**
 * HMW_138 Commander Gree — "3 or more Command aspect icons among friendly units (including this
 * one) and upgrades".
 *
 * ICONS, not cards: a card printing Command twice contributes 2, which is why this sums the
 * aspect list rather than counting matching cards. Upgrades count as well, on either a unit or
 * the base, and a token upgrade belongs to the unit's controller rather than its own.
 */
function friendlyCommandIconCount(gs: GameState, player: PlayerId): number {
  const icons = (cardId: string) => CardAspects(cardId).filter(a => a === "Command").length;
  let total = 0;
  for (const unit of GetUnitsForPlayer(player)) {
    total += icons(unit.cardId);
    for (const upg of unit.upgrades) total += icons(upg.cardId);
  }
  total += (GetPlayer(gs, player).base.upgrades ?? []).reduce((n, upg) => n + icons(upg.cardId), 0);
  return total;
}

/** Raid granted by an upgrade attached to this player's BASE (HMW_126 Verdant Fortress). */
function raidFromBaseUpgrades(gs: GameState, player: PlayerId): number {
  let amount = 0;
  for (const upg of GetPlayer(gs, player).base.upgrades ?? []) {
    switch (upg.cardId) {
      case "HMW_126": // Verdant Fortress — "Attached base gains: Friendly units gain Raid 1."
        amount += 1;
        break;
      default: break;
    }
  }
  return amount;
}

export function RaidAmount(cardId: string, playId?: string, player?: PlayerId, isRecursion = false): number {
  let amount = 0;
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (!unit) return amount;
    if (unit.LostAbilities()) return 0;
    //Support: the attacker has gained the supporting unit's keywords for this attack.
    const supported = SupportGrantedCardId(playId, player);
    if (supported) amount += RaidAmount(supported);
    // LAW_233 Galen Erso: enemy units (of Galen's controller) gain Raid 1.
    if (GetPlayIdForUniqueUnitInPlay("LAW_233", player === 1 ? 2 : 1) !== "0") amount += 1;
    const gs = GetGame()?.currentGameState;
    if (gs) {
      amount += raidFromBaseUpgrades(gs, player);
      // HMW_138 Commander Gree — his own clause, so it is read off HIM, not off every unit.
      if (cardId === "HMW_138" && friendlyCommandIconCount(gs, player) >= 3) amount += 4;
    }
    const units = GetUnitsForPlayer(player);
    for(const u of units) {
      switch(u.cardId)
      {
        case "SOR_144"://Red Three
          if(playId !== u.playId && CardAspects(cardId).includes("Heroism")) amount += 1;
          break;
        case "SOR_012"://IG-88 Leader Unit
        case "SEC_140"://Hondo Ohnaka (You Better Hurry) — same aura
          if(playId !== u.playId && !Unit.FromInterface(u).LostAbilities()) amount += 1;
          break;
        case "HMW_007"://Darth Vader (Might of the Empire) Leader Unit — "OTHER friendly units that cost 3 or more gain Raid 1"
          if (playId !== u.playId && (CardCost(cardId) ?? 0) >= 3 && !Unit.FromInterface(u).LostAbilities()) amount += 1;
          break;
        case "JTL_134"://General Hux
          if(playId != u.playId && TraitContains(cardId, "First Order", player, playId)) amount += 1;
          break;
        case "LOF_169"://Invasion Control Ship
          if(TraitContains(cardId, "Droid", player, playId)) amount +=2;
          break;
        case "SEC_099"://Naboo Royal Starship
          if(unit.IsLeader()) amount += 2;
          break;
        default: break;
      }
    }
    // HMW_007 Darth Vader (Might of the Empire), front — from the LEADER ZONE: "Friendly units that
    // cost 3 or more gain Raid 1." Deployed, the unit side's aura above takes over.
    const leader007 = GetLeaderForPlayer(player);
    if (leader007.cardId === "HMW_007" && !leader007.deployed && !LeaderAbilitiesIgnored()
        && (CardCost(cardId) ?? 0) >= 3) {
      amount += 1;
    }
    for(const currentEffect of GetCurrentEffectsForPlayer(player)) {
      if(currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) continue;
      switch(currentEffect.cardId) {
        case "SOR_156"://Benthic "Two Tubes"
          amount += 2;
          break;
        case "SOR_154"://Rallying Cry
          amount += 2;
          break;
        case "TWI_250"://Sword and Shield Maneuver
          amount += TraitContains(cardId, "Trooper", player, playId) ? 1 : 0;
          break;
        case "LOF_152"://Focus Determines Reality
          amount += TraitContains(cardId, "Force", player, playId) ? 1 : 0;
          break;
        default: break;
      }
    }
    const upgrades = unit.upgrades;
    for(const u of upgrades) {
      switch(u.cardId) {
        case "TWI_169"://Clone Cohort
          amount += 2;
          break;
        case "JTL_211"://Independent Smuggler
          amount += 1;
          break;
        case "LOF_261"://Constructed Lightsaber
          if(CardAspects(cardId).includes("Villainy")) amount += 2;
          break;
        default: break;
      }
    }
    const otherPlayer = player === 1 ? 2 : 1;
    switch (unit.cardId) {
      //conditional raid
      case "ASH_093": amount += LeaderUnitWasDefeatedThisPhase() ? 3 : 0; break;//Captain Pellaeon (Plotting from the Shadows)
      case "SOR_159": amount += PlayerHasUnitWithAspectInPlay(player, "Aggression", true, playId) ? 2 : 0; break;//Partisan Insurgent
      case "SOR_131": amount += unit.TotalHP() - unit.CurrentHP(); break;//Fifth Brother
      case "SOR_188": // Chopper (SOR)
      case "SEC_147": amount += PlayerHasUnitWithTraitInPlay(player, "Spectre", true, playId) ? 1 : 0; break;//Chopper
      case "LOF_162": //Hunting Nexu (LOF reprint)
      case "SHD_168": amount += PlayerHasUnitWithAspectInPlay(player, "Aggression", true, playId) ? 2 : 0; break;//Hunting Nexu
      case "TWI_164": amount += IsCoordinateActive(player) ? 2 : 0; break;//Hevy
      case "TWI_196": amount += IsCoordinateActive(player) ? 3 : 0; break;//Plo Koon
      case "TWI_180": amount += PlayerHasUnitWithTraitInPlay(player, "Separatist", true, playId) ? 2 : 0; break;//Separatist Commando
      case "ASH_105": amount += PlayerHasUnitWithTraitInPlay(player, "Mandalorian", true, playId) ? 2 : 0; break;//Bo-Katan Kryze
      case "JTL_081": amount += PlayerHasTokenUnitInPlay(player) ? 1 : 0; break;//First Order TIE Fighter
      case "JTL_257": amount += PlayerHasUnitWithTraitInPlay(player, "Fighter", true, playId) ? 2 : 0; break;//Flanking Fang Fighter
      case "JTL_137": amount += (unit.CurrentPower() + amount) >= 6 ? 1 : 0; break;//Vonreg's TIE Interceptor
      case "LOF_212"://Life Wind Sage
        amount += GetUnitsForPlayer(otherPlayer).some(u => !u.ready) ? 2 : 0;
        break;
      case "SEC_134"://Hunting Assassin Droid — while an enemy unit is damaged, gains Raid 2.
        amount += GetUnitsForPlayer(otherPlayer).some(u => u.damage > 0) ? 2 : 0;
        break;
      case "LOF_105"://Oppo Rancisis
        if(isRecursion) return 0; //Prevent recursion
        for(const u of units) {
          if(u.playId === playId) continue;
          if(RaidAmount(u.cardId, u.playId, player, true) > 0) {
            amount += 2;
            break;
          }
        }
        break;
      case "SEC_201": //Anakin Skywalker (SEC)
        if (PlayerControlsCardWithTitle(player, "Padmé Amidala")) {
          amount += 2;
        }
        break;
      case "SEC_010"://Dedra Meero leader unit
        amount += !LeaderAbilitiesIgnored()
          ? (GetHand(player).length > GetHand(otherPlayer).length ? 2 : 0)
          : 0;
        break;
    }
  }
  switch(cardId)
  {
    //Leader Units
    case "SOR_009": amount += !LeaderAbilitiesIgnored() ? 1 : 0; break; //Leia Leader Unit
    case "SHD_014": amount += !LeaderAbilitiesIgnored() ? 2 : 0; break; //Cad Bane Leader Unit
    case "SHD_005": amount += !LeaderAbilitiesIgnored() ? 1 : 0; break; //Hondo Ohnaka Leader Unit
    case "HMW_007": amount += !LeaderAbilitiesIgnored() ? 1 : 0; break; //Darth Vader (Might of the Empire) Leader Unit
    case "HMW_018": amount += !LeaderAbilitiesIgnored() ? 1 : 0; break; //The Warrior (Deft Duelist) Leader Unit
    case "TS26_05": amount += !LeaderAbilitiesIgnored() ? 3 : 0; break; //Savage Opress (You Must Have Your Revenge) Leader Unit
    //non-Leader Units
    case "SOR_194": amount += 2; break; //Rogue Operative
    case "SOR_157": amount += 2; break; //Cantina Braggart
    case "SOR_141": amount += 2; break; //Green Squadron A-Wing
    case "SOR_209": amount += 1; break; //Pirated Starfighter
    case "SOR_144": amount += 1; break; //Red Three
    case "SOR_208": amount += 1; break; //Outer Rim Headhunter
    case "SOR_248": //Volunteer Soldier
    case "TWI_254": amount += 1; break; //Volunteer Soldier (TWI reprint)
    case "HMW_039": amount += 1; break; //Mother Talzin (Pledged to the Sisterhood)
    case "HMW_167": amount += 3; break; //Dune Sea Nomads
    case "HMW_106": amount += 1; break; //Secessionist Convert
    case "HMW_120": amount += 2; break; //Auzituck Avenger
    case "HMW_140": amount += 4; break; //Assault Frigate
    case "HMW_157": amount += 2; break; //Corpo Thugs
    case "HMW_175": amount += 2; break; //Fennec Shand - A Ship For A Life
    case "HMW_181": amount += 4; break; //Tusken Bantha Rider
    case "HMW_201": amount += 1; break; //Sandtrooper Squad
    case "HMW_213": amount += 3; break; //Tribubble Bongo Sub
    case "HMW_224": amount += 3; break; //Tusken Raider
    case "HMW_227": amount += 2; break; //Horizon Chaser
    case "HMW_245": amount += 3; break; //Trandoshan Collaborator
    case "HMW_254": amount += 2; break; //Captain Tarpals - Grand Army Captain
    case "SEC_222": amount += 1; break; //Loan Shark
    case "TS26_21": amount += 2; break; //Gar Saxon - Sundari Pillager
    case "SHD_169": amount += 3; break; //Clan Challengers
    case "SHD_098": amount += 2; break; //Sundari Peacekeeper
    case "SHD_100": amount += 2; break; //Modded Cohort
    case "SHD_191": amount += 2; break; //Xanadu Blood
    case "SHD_187": amount += 2; break; //Lurking TIE Phantom
    case "TWI_108": amount += 1; break; //Ryloth Militia
    case "TWI_145": amount += 1; break; //Jesse
    case "TWI_141": amount += 1; break; //Soldier of the 501st
    case "TWI_150": amount += 2; break; //Saw Gerrera
    case "TWI_104": amount += 1; break; //Obedient Vanguard
    case "TWI_183": amount += 2; break; //Rush Clovis
    case "JTL_111": amount += 1; break; //Seasoned Fleet Admiral
    case "JTL_211": amount += 1; break; //Independent Smuggler
    case "JTL_118": amount += 1; break; //MC30 Assault Frigate
    case "JTL_225": amount += 1; break; //Corporate Light Cruiser
    case "LOF_228": amount += 1; break; //Forged Starfighter
    case "LOF_136": amount += 3; break; //Thralls of the Coven
    case "LOF_131": amount += 3; break; //Strikeship
    case "LOF_179": amount += 2; break; //Aurra Sing
    case "LOF_182": amount += 3; break; //Nihil Marauder
    case "LOF_251": amount += 1; break; //Blue Suqadron Assault Wing
    case "LOF_157": amount += 2; break; //Cartel Interceptor
    case "LOF_132": amount += 1; break; //Grand Inquisitor LOF
    case "LOF_209": amount += 2; break; //Tusken Tracker
    case "IBH_004": //Rogue Squadron Speeder — Raid 1
    case "IBH_017":
    case "IBH_034": amount += 1; break;
    case "IBH_069": //E-Web Gunner — Raid 4
    case "IBH_083": amount += 4; break;
    case "IBH_078": //Surface Assault Bomber — Raid 1
    case "IBH_093":
    case "IBH_094": amount += 1; break;
    case "IC27_161": // reprint of IBH_010
    case "IBH_010": //Han Solo — Raid 2
    case "IBH_042": amount += 2; break;
    case "SEC_T01": amount += 2; break; //Spy token
    case "IC27_169": // reprint of SEC_213
    case "SEC_213": amount += 1; break; //A-Wing
    case "LAW_050": amount += 2; break; //Honnah
    case "LAW_082": amount += 4; break; //Urrr'k
    case "LAW_090": amount += 1; break; //Toydarian Technician
    case "LAW_154": amount += 1; break; //Partisan Infantry
    case "LAW_172": amount += 1; break; //Storm Raider
    case "LAW_190": amount += 2; break; //Haxion Aggressor
    case "LAW_199": amount += 3; break; //Ohnaka Gang Bandits
    case "LAW_210": amount += 2; break; //Salacious Crumb
    case "LAW_220": amount += 2; break; //Wookiee Guerilla
    case "LAW_234": amount += 2; break; //Kage Elite
    case "ASH_154": amount += 1; break; //Honorable Nite Owl
    case "ASH_237": amount += 1; break; //Mouse Droid
    default: break;
  }

  //JTL_053: The Ghost - Heart of the Family
  if (player) {
    const theGhostPlayId = GetPlayIdForUniqueUnitInPlay("JTL_053", player);
    if(theGhostPlayId !== "0" && TraitContains(cardId, "Spectre", player)
        && playId !== theGhostPlayId)
      amount += RaidAmount("JTL_053", theGhostPlayId, player);

      //Marchion Ro
      const marchionRoPlayId = GetPlayIdForUniqueUnitInPlay("LOF_186", player);
      if(marchionRoPlayId !== "0") amount *= 2;
  }

  return amount;
}