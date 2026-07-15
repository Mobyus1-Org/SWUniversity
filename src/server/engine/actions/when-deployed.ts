import { PendingResolution } from "@/server/engine/pending-resolution";
import { PlayerId } from "@/lib/engine/core-models";
import { GetGame, CardIsLeader } from "@/server/engine/core-functions";
import { CardTitle } from "@/server/engine/card-db/generated";
import { Unit } from "@/server/engine/unit";
import { chooseFriendlyForPowerDamage } from "@/server/engine/actions/deal-power-damage";
import { CreateCloneTrooper } from "@/server/engine/token-helpers";

export function resolveWhenDeployed(
  cardId: string,
  player: PlayerId,
  log: string[],
): PendingResolution | null {
  const game = GetGame();
  if (!game) throw new Error("Game not found in resolveWhenDeployed");
  switch (cardId) {
    case "LAW_010": { // Leia Organa — "When Deployed: Choose a unit. Give an Experience token to
                      // that unit for each different aspect among units you control."
      const units010 = [
        ...game.currentGameState.player1.groundArena, ...game.currentGameState.player1.spaceArena,
        ...game.currentGameState.player2.groundArena, ...game.currentGameState.player2.spaceArena,
      ];
      if (units010.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LAW_010_deployed",
        player,
        fromPlayIds: units010.map(u => u.playId),
        continuation: null,
      };
    }
    case "TWI_007": { // Captain Rex — When Deployed: Create a Clone Trooper token.
      CreateCloneTrooper(game.currentGameState, player, log, "TWI_007");
      return null;
    }
    case "SHD_015": { // Doctor Aphra — When Deployed: Choose 3 cards in your discard pile with
                      // different names. If you do, return 1 of them at random to your hand.
      const discard015 = (player === 1 ? game.currentGameState.player1 : game.currentGameState.player2).discard;
      const distinctNames015 = new Set(discard015.map(d => d.cardId));
      if (distinctNames015.size < 3) return null; // can't choose 3 different names — skip
      return {
        type: "return-from-discard",
        cardId: "SHD_015",
        player,
        maxCount: 3,
        eligiblePlayIds: discard015.map(d => d.playId),
        continuation: null,
      };
    }
    case "TWI_004": { // Yoda — When Deployed: You may discard a card from your deck. If you do,
                      // defeat an enemy non-leader unit that costs the same as or less than it.
      const deck004 = (player === 1 ? game.currentGameState.player1 : game.currentGameState.player2).deck;
      if (deck004.length === 0) return null;
      return {
        type: "ability-option",
        cardId: "TWI_004",
        player,
        helperText: "Discard a card from your deck to defeat an enemy unit costing the same or less?",
        yesLabel: "Discard from deck",
        noLabel: "Skip",
        onYes: {
          type: "mill",
          cardId: "TWI_004",
          player,
          millingPlayer: player,
          count: 1,
          continuation: null,
        },
        continuation: null,
      };
    }
    case "SHD_002": { // Qi'ra — heal all damage from each unit, then deal floor(TotalHP/2) to each
      const gs = game.currentGameState;
      const allUnits = [
        ...gs.player1.groundArena,
        ...gs.player1.spaceArena,
        ...gs.player2.groundArena,
        ...gs.player2.spaceArena,
      ];
      for (const u of allUnits) {
        u.damage = 0;
      }
      for (const u of allUnits) {
        const unit = Unit.FromInterface(u);
        const damage = Math.floor(unit.TotalHP() / 2);
        const shieldIdx = u.upgrades.findIndex(upg => upg.cardId === "SOR_T02");
        if (shieldIdx !== -1) {
          u.upgrades.splice(shieldIdx, 1);
          log.push(`${CardTitle(u.cardId)}'s Shield token absorbed Qi'ra's damage.`);
        } else {
          u.damage += damage;
          log.push(`Qi'ra dealt ${damage} damage to ${CardTitle(u.cardId)}.`);
        }
      }
      return null;
    }
    case "SOR_006": { // Emperor Palpatine — "When Deployed: Take control of a damaged non-leader unit."
      const gs = game.currentGameState;
      const eligible = [
        ...gs.player1.groundArena, ...gs.player1.spaceArena,
        ...gs.player2.groundArena, ...gs.player2.spaceArena,
      ].filter(u => !CardIsLeader(u.cardId) && u.damage > 0);
      if (eligible.length === 0) {
        log.push(`${CardTitle(cardId)}: no damaged non-leader units to take control of.`);
        return null;
      }
      return {
        type: "ability-target",
        cardId: "SOR_006_D",
        player,
        fromPlayIds: eligible.map(u => u.playId),
        continuation: null,
      };
    }
    case "LAW_008": { // Director Krennic — When Deployed: Another friendly unit deals damage equal to its power to an enemy unit.
      const leader008 = (player === 1 ? game.currentGameState.player1 : game.currentGameState.player2).leader;
      return chooseFriendlyForPowerDamage("LAW_008_wd", player, { excludePlayId: leader008.deployedPlayId });
    }
    case "LOF_012": { // Rey — When Deployed: You may discard your hand. If you do, draw 2 cards.
      const hand012 = (player === 1 ? game.currentGameState.player1 : game.currentGameState.player2).hand;
      if (hand012.length === 0) return null; // nothing to discard — the option is meaningless
      return {
        type: "ability-option",
        cardId: "LOF_012_wd",
        player,
        helperText: "Discard your hand to draw 2 cards?",
        yesLabel: "Discard & draw 2",
        noLabel: "Skip",
        onYes: null,
        continuation: null,
      };
    }
    case "JTL_014": { // Admiral Trench — When Deployed: Reveal the top 4 cards of your deck. An
                      // opponent discards 2 of them. Draw 1 of the remaining cards and discard the other.
      const deck014 = (player === 1 ? game.currentGameState.player1 : game.currentGameState.player2).deck;
      if (deck014.length === 0) return null;
      // The top of the deck is the END of the array; reveal up to 4 from the top.
      const revealCount = Math.min(4, deck014.length);
      const revealed = deck014.splice(deck014.length - revealCount, revealCount)
        .map((c, i) => ({ tempId: String(i), cardId: c.cardId }));
      log.push(`${CardTitle("JTL_014")}: revealed the top ${revealed.length} card(s) of the deck.`);
      const opponent: PlayerId = player === 1 ? 2 : 1;
      return {
        type: "trench-reveal",
        cardId: "JTL_014",
        player,
        chooser: opponent,
        stage: "opponent-discard",
        revealed,
        continuation: null,
      };
    }
    default:
      return null;
  }
}
