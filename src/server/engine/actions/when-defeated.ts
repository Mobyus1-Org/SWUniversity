import { Unit } from "@/server/engine/unit";
import { AbilityOptionPending, DeckSearchPending, PendingResolution, SpreadDamagePending } from "@/server/engine/pending-resolution";
import { PlayerId } from "@/lib/engine/core-models";
import { DrawCardForPlayer, GetGame, GetUnitsForPlayer, InitiativePlayer } from "@/server/engine/core-functions";
import { CardAspects, CardTitle } from "@/server/engine/card-db/generated";
import { CreateBattleDroid } from "@/server/engine/token-helpers";

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
        CreateBattleDroid(game.currentGameState, player);
        game.gameLog.push(`Droid Cohort: Battle Droid token created for ${CardTitle(unit.cardId)}.`);
      }
    }
  }

  switch (unit.cardId) {
    case "SOR_083": { // Superlaser Technician: "When Defeated: You may put this unit into play as a resource and ready it."
      return {
        type: "when-defeated-choice",
        defeatedCardId: unit.cardId,
        defeatedPlayId: unit.playId,
        controlledBy: player,
        options: [`put_into_play_as_resource=${unit.cardId},${player}`, "decline"],
        continuation: null,
      };
    }
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
    case "SOR_108": { // Vanguard Infantry — "When Defeated: You may give an Experience token to a unit."
      const game108 = GetGame();
      if (!game108) return null;
      const gs108 = game108.currentGameState;
      const allUnits108 = [
        ...gs108.player1.groundArena, ...gs108.player1.spaceArena,
        ...gs108.player2.groundArena, ...gs108.player2.spaceArena,
      ];
      if (allUnits108.length === 0) return null;
      return {
        type: "ability-option",
        cardId: "SOR_108",
        helperText: "Give an Experience token to a unit?",
        onYes: {
          type: "ability-target",
          cardId: "SOR_108",
          player,
          fromPlayIds: allUnits108.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "SOR_226": { // Admiral Motti — "When Defeated: You may ready a [Villainy] unit."
      const game226 = GetGame();
      if (!game226) return null;
      const gs226 = game226.currentGameState;
      const villainyUnits = [
        ...gs226.player1.groundArena, ...gs226.player1.spaceArena,
        ...gs226.player2.groundArena, ...gs226.player2.spaceArena,
      ].filter(u => CardAspects(u.cardId).includes("Villainy"));
      if (villainyUnits.length === 0) return null;
      return {
        type: "ability-option",
        cardId: "SOR_226",
        helperText: "Ready a [Villainy] unit?",
        onYes: {
          type: "ability-target",
          cardId: "SOR_226",
          player,
          fromPlayIds: villainyUnits.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "TWI_229": { // Battle Droid Escort — "When Defeated: Create a Battle Droid token."
      const game229 = GetGame();
      if (!game229) return null;
      CreateBattleDroid(game229.currentGameState, player);
      game229.gameLog.push(`${CardTitle("TWI_229")}: Battle Droid token created.`);
      return null;
    }
    case "SOR_060": { // Distant Patroller — When Defeated: You may give a Shield token to a [Vigilance] unit.
      const game060 = GetGame();
      if (!game060) return null;
      const gs060 = game060.currentGameState;
      const vigilanceUnits060 = [
        ...gs060.player1.groundArena, ...gs060.player1.spaceArena,
        ...gs060.player2.groundArena, ...gs060.player2.spaceArena,
      ].filter(u => CardAspects(u.cardId).includes("Vigilance"));
      if (vigilanceUnits060.length === 0) return null;
      return {
        type: "ability-option",
        cardId: "SOR_060",
        helperText: "Give a Shield token to a [Vigilance] unit?",
        yesLabel: "Give Shield",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "SOR_060",
          player,
          fromPlayIds: vigilanceUnits060.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "SOR_134": { // Ruthless Raider — When Defeated: Deal 2 to enemy base + 2 to an enemy unit.
      const game134 = GetGame();
      if (!game134) return null;
      const gs134 = game134.currentGameState;
      const oppState134 = player === 1 ? gs134.player2 : gs134.player1;
      oppState134.base.damage += 2;
      game134.gameLog.push(`${CardTitle("SOR_134")}: dealt 2 damage to opponent's base.`);
      const enemyUnits134 = [...oppState134.groundArena, ...oppState134.spaceArena];
      if (enemyUnits134.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_134",
        player,
        fromPlayIds: enemyUnits134.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_031": { // Inferno Four — When Defeated: Look at top 2, put any on bottom, rest on top.
      const game031 = GetGame();
      if (!game031) return null;
      const deck031 = player === 1 ? game031.currentGameState.player1.deck : game031.currentGameState.player2.deck;
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
    case "SOR_163": { // Star Wing Scout — When Defeated: If you have the initiative, draw 2 cards.
      if (InitiativePlayer() !== player) return null;
      const game163 = GetGame();
      if (!game163) return null;
      DrawCardForPlayer(game163.currentGameState, game163.gameLog, player);
      DrawCardForPlayer(game163.currentGameState, game163.gameLog, player);
      game163.gameLog.push(`${CardTitle("SOR_163")}: drew 2 cards.`);
      return null;
    }
    default:
      return null;
  }
}