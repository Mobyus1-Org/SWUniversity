import { Unit } from "@/server/engine/unit";
import { DeckSearchPending, MillPending, PendingResolution, SpreadDamagePending, SpreadTokensPending } from "@/server/engine/pending-resolution";
import { PlayerId } from "@/lib/engine/core-models";
import { AllUnits, CanDisclose, CaptureVictimsExistFor, DrawCardForPlayer, GetGame, GetGameState, GetUnitsForPlayer, HasTheForce, InitiativePlayer, UnitsWithAspect, mandatoryTarget, optionalTarget, buildTakeControlOfUpgrade } from "@/server/engine/core-functions";
import { IsTokenUpgrade } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { CardAspects, CardPower, CardTitle } from "@/server/engine/card-db/generated";
import { UpgradePowerOf } from "@/server/engine/card-db/upgrade-stats";
import { CreateBattleDroid, CreateTieFighter } from "@/server/engine/token-helpers";

/**
 * When Defeated abilities — called immediately after the unit is removed from
 * play and placed in the discard.
 */
export function resolveWhenDefeated(
  unit: Unit,
  player: PlayerId
): PendingResolution | null {
  // TWI_218 Droid Cohort: attached unit gains "When Defeated: Create a Battle Droid token."
  const droidCohortCount = unit.upgrades.filter(u => u.cardId === "TWI_218").length;
  if (droidCohortCount > 0) {
    const game = GetGame();
    if (game) {
      for (let i = 0; i < droidCohortCount; i++) {
        CreateBattleDroid(game.currentGameState, player, game.gameLog, "TWI_218");
      }
    }
  }

  // SOR_105 General Krell: each other friendly unit gains "When Defeated: You may draw a card."
  // The dying unit is already removed from the arena before this runs, so any Krell found
  // in GetUnitsForPlayer is a surviving unit — never the unit that just died.
  const krellInPlay = GetUnitsForPlayer(player).some(u => u.cardId === "SOR_105");
  if (krellInPlay) {
    return {
      type: "ability-option",
      cardId: "SOR_105",
      player,
      helperText: `${CardTitle("SOR_105")}: draw a card?`,
      yesLabel: "Draw",
      noLabel: "Skip",
      onYes: null,
      continuation: resolveOwnWhenDefeated(unit, player),
    };
  }

  return resolveOwnWhenDefeated(unit, player);
}

/** Power of a unit that has just left play: printed power plus its upgrades' contributions. */
function LastKnownPower(unit: Unit): number {
  const fromUpgrades = unit.upgrades.reduce((sum, upg) => sum + UpgradePowerOf(upg.cardId), 0);
  return Math.max(0, (CardPower(unit.cardId) || 0) + fromUpgrades);
}

function resolveOwnWhenDefeated(
  unit: Unit,
  player: PlayerId
): PendingResolution | null {
  switch (unit.cardId) {
    case "JTL_242": // Shuttle ST-149 — When Played/When Defeated: may take control of a token upgrade and attach it to a different eligible unit.
      return buildTakeControlOfUpgrade("JTL_242", player,
        upg => IsTokenUpgrade(upg.cardId),
        "Take control of a token upgrade and attach it to a different eligible unit?", null);
    case "SOR_083": // Superlaser Technician (SOR_083 / SHD_085 reprint): "When Defeated: You may put this unit into play as a resource and ready it."
    case "SHD_085": {
      return {
        type: "ability-option",
        cardId: unit.cardId,
        player,
        sourcePlayId: unit.playId,
        helperText: "Put Superlaser Technician into play as a ready resource?",
        yesLabel: "Put into play",
        noLabel: "Decline",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_147": // Black One — "When Played/When Defeated: You may discard your hand. If you do, draw 3 cards."
      return {
        type: "ability-option",
        cardId: "SOR_147",
        player,
        helperText: "Discard your hand and draw 3 cards?",
        yesLabel: "Discard & Draw 3",
        noLabel: "Skip",
        onYes: null,
        continuation: null,
      };
    case "SOR_145": { //K-2SO "When Defeated: For each opponent, choose one: either deal 3 damage to that player's base, or that player discards a card from their hand."
      const opponent = player === 1 ? 2 : 1;
      return {
        type: "when-defeated-choice",
        defeatedCardId: unit.cardId,
        defeatedPlayId: unit.playId,
        controlledBy: player,
        options: [`deal_base_damage=${opponent},3`, `player_discards_from_hand=${opponent},1`],
      };
    }
    case "LAW_159": { // Expendable Mercenary — "When Defeated: You may resource this unit from its
                      // owner's discard pile." The ability belongs to its controller; the card is
                      // in its OWNER's discard (that's the distinction the text draws).
      return {
        type: "ability-option",
        cardId: "LAW_159",
        player, // the controller at the time it was defeated
        sourcePlayId: unit.playId, // locates the card in the discard pile
        helperText: `Resource ${CardTitle("LAW_159")} from its owner's discard pile?`,
        yesLabel: "Resource it",
        noLabel: "Leave it in the discard",
        amount: unit.owner, // whose discard pile to take it from
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_204": { // Greedo — When Defeated: You may discard a card from your deck. If it's not a unit, deal 2 damage to a ground unit.
      const gs204 = GetGameState();
      const deck204 = player === 1 ? gs204.player1.deck : gs204.player2.deck;
      if (deck204.length === 0) return null;
      return {
        type: "ability-option",
        cardId: "SOR_204",
        player,
        helperText: "Discard the top card of your deck?",
        yesLabel: "Discard",
        noLabel: "Skip",
        onYes: {
          type: "mill",
          cardId: "SOR_204",
          player,
          millingPlayer: player,
          count: 1,
          continuation: null,
        } satisfies MillPending,
        continuation: null,
      };
    }
    case "LOF_213": { // The Legacy Run — When Defeated: Deal 6 damage divided as you choose among enemy units.
      const opponent213 = player === 1 ? 2 : 1;
      const enemies213 = GetUnitsForPlayer(opponent213);
      if (enemies213.length === 0) return null;
      return {
        type: "spread-damage",
        cardId: unit.cardId,
        player,
        totalDamage: 6,
        optional: false,
        eligiblePlayIds: enemies213.map(u => u.playId),
        continuation: null,
      } satisfies SpreadDamagePending;
    }
    case "JTL_033": { // Onyx Squadron Brute — When Defeated: Heal 2 damage from a base.
      return mandatoryTarget("JTL_033", player, ["player1.base", "player2.base"]);
    }
    case "JTL_039": { // Chimaera — When Defeated: Create 2 TIE Fighter tokens.
      const game039 = GetGame();
      if (!game039) return null;
      CreateTieFighter(game039.currentGameState, player, game039.gameLog, "JTL_039");
      CreateTieFighter(game039.currentGameState, player, game039.gameLog, "JTL_039");
      return null;
    }
    case "JTL_060": { // Desperate Commando — When Defeated: You may give a unit –1/–1 for this phase.
      const units060 = AllUnits();
      if (units060.length === 0) return null;
      return optionalTarget("JTL_060", player, units060.map(u => u.playId),
        "Give a unit –1/–1 for this phase?");
    }
    case "LOF_031": { // Karis — When Defeated: You may use the Force. If you do, give a unit –2/–2 for this phase.
      if (!HasTheForce(player)) return null;
      if (AllUnits().length === 0) return null; // nothing to debuff — don't burn the Force token
      return {
        type: "ability-option",
        cardId: "LOF_031",
        player,
        helperText: "Use the Force to give a unit –2/–2 for this phase?",
        yesLabel: "Use the Force",
        noLabel: "Skip",
        onYes: null, // the Force is spent in the Yes handler, which then asks for the target
        continuation: null,
      };
    }
    case "SEC_148": { // Karis Nemik — When Defeated: You may disclose Aggression+Heroism.
                      // If you do, create a Spy token and ready it.
      if (!CanDisclose(player, ["Aggression", "Heroism"])) return null;
      return {
        type: "ability-option",
        cardId: "SEC_148",
        player,
        helperText: "Disclose Aggression + Heroism to create a ready Spy token?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: { type: "play-from-hand", cardId: "SEC_148", player },
        continuation: null,
      };
    }
    case "ASH_195": { // Helgait — "When Defeated: You may distribute a number of Advantage tokens
                      // equal to this unit's power among friendly units (divided as you choose)."
      const friendly195 = GetUnitsForPlayer(player);
      if (friendly195.length === 0) return null;
      // CR 8.11 last known information: the unit is already out of play, so its power can't be
      // recomputed live (CurrentPower would look itself up in an arena it has left). Take the
      // printed power plus whatever its upgrades were giving it as it left.
      const tokens195 = LastKnownPower(unit);
      if (tokens195 <= 0) return null;
      return {
        type: "spread-tokens",
        cardId: "ASH_195",
        player,
        totalTokens: tokens195,
        optional: true,
        eligiblePlayIds: friendly195.map(u => u.playId),
        continuation: null,
      } satisfies SpreadTokensPending;
    }
    case "SEC_193": { // Grand Admiral Thrawn — "When Defeated: A friendly unit captures an enemy
                      // non-leader unit in the same arena." Step 1 picks the captor.
      const friendly193 = GetUnitsForPlayer(player);
      if (friendly193.length === 0) return null;
      // Only units that actually have an enemy non-leader unit in their arena can capture.
      const captors193 = friendly193.filter(u => CaptureVictimsExistFor(u));
      if (captors193.length === 0) return null;
      return mandatoryTarget("SEC_193_wd", player, captors193.map(u => u.playId));
    }
    case "SOR_108": { // Vanguard Infantry — "When Defeated: You may give an Experience token to a unit."
      const units108 = AllUnits();
      if (units108.length === 0) return null;
      return optionalTarget("SOR_108", player, units108.map(u => u.playId),
        "Give an Experience token to a unit?");
    }
    case "SOR_226": { // Admiral Motti — "When Defeated: You may ready a [Villainy] unit."
      const villainyUnits = UnitsWithAspect("Villainy");
      if (villainyUnits.length === 0) return null;
      return optionalTarget("SOR_226", player, villainyUnits.map(u => u.playId),
        "Ready a [Villainy] unit?");
    }
    case "TWI_229": { // Battle Droid Escort — "When Defeated: Create a Battle Droid token."
      const game229 = GetGame();
      if (!game229) return null;
      CreateBattleDroid(game229.currentGameState, player, game229.gameLog, "TWI_229");
      return null;
    }
    case "SOR_060": { // Distant Patroller — When Defeated: You may give a Shield token to a [Vigilance] unit.
      const vigilanceUnits = UnitsWithAspect("Vigilance");
      if (vigilanceUnits.length === 0) return null;
      return optionalTarget("SOR_060", player, vigilanceUnits.map(u => u.playId),
        "Give a Shield token to a [Vigilance] unit?",
        { yesLabel: "Give Shield" });
    }
    case "SOR_134": { // Ruthless Raider — When Defeated: Deal 2 to enemy base + 2 to an enemy unit.
      const game134 = GetGame();
      if (!game134) return null;
      const gs134 = game134.currentGameState;
      const oppState134 = player === 1 ? gs134.player2 : gs134.player1;
      const enemyUnits134 = [...oppState134.groundArena, ...oppState134.spaceArena];
      if (enemyUnits134.length === 0) {
        // No enemy unit to hit — apply the base damage here (the ability-target resolution won't run).
        oppState134.base.damage += 2;
        game134.gameLog.push(`${CardTitle("SOR_134")}: dealt 2 damage to opponent's base.`);
        return null;
      }
      // Base + unit damage are applied together when the ability-target resolves (applyAbilityEffect).
      return mandatoryTarget("SOR_134", player, enemyUnits134.map(u => u.playId));
    }
    case "SOR_031": { // Inferno Four — When Defeated: Look at top 2, put any on bottom, rest on top.
      const gs031 = GetGameState();
      const deck031 = player === 1 ? gs031.player1.deck : gs031.player2.deck;
      if (deck031.length === 0) return null;
      const count031 = Math.min(2, deck031.length);
      const top031 = deck031.slice(-count031);
      const topCards031 = top031.map((c, i) => ({ tempId: `${i}`, cardId: c.cardId }));
      const eligible031 = topCards031.map(c => ({ ...c, cost: 0 }));
      return {
        type: "deck-search",
        cardId: "SOR_031",
        player,
        topCards: topCards031,
        eligibleChoices: eligible031,
        action: "scry",
        continuation: null,
      } satisfies DeckSearchPending;
    }
    case "ASH_116": { // Ant Droid — When Defeated: Draw a card.
      const game116 = GetGame();
      if (!game116) return null;
      DrawCardForPlayer(game116.currentGameState, game116.gameLog, player);
      game116.gameLog.push(`${CardTitle("ASH_116")}: drew a card.`);
      return null;
    }
    case "SOR_163": { // Star Wing Scout — When Defeated: If you have the initiative, draw 2 cards.
      if (InitiativePlayer() !== player) return null;
      const game163 = GetGame();
      if (!game163) return null;
      DrawCardForPlayer(game163.currentGameState, game163.gameLog, player);
      DrawCardForPlayer(game163.currentGameState, game163.gameLog, player);
      game163.gameLog.push(`${CardTitle("SOR_163")}: drew 2 cards.`);
      return null;
    }
    case "SOR_045": { // Yoda — When Defeated: Choose any number of players. They each draw a card.
      const game045 = GetGame();
      if (!game045) return null;
      return {
        type: "ability-option",
        cardId: unit.cardId,
        player,
        helperText: "You draw a card?",
        yesLabel: "Draw",
        noLabel: "Skip",
        onYes: null,
        continuation: {
          type: "ability-option",
          cardId: "SOR_045_opp",
          player,
          helperText: "Opponent draws a card?",
          yesLabel: "Draw",
          noLabel: "Skip",
          onYes: null,
          continuation: null,
        },
      };
    }
    case "SOR_049": { // Obi-Wan Kenobi — When Defeated: Give 2 XP to another friendly unit. If Force, draw a card.
      const friendlies049 = GetUnitsForPlayer(player).filter(u => u.playId !== unit.playId);
      if (friendlies049.length === 0) return null;
      return mandatoryTarget(unit.cardId, player, friendlies049.map(u => u.playId));
    }
    default:
      return null;
  }
}
