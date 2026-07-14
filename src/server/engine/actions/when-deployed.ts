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
    case "TWI_007": { // Captain Rex — When Deployed: Create a Clone Trooper token.
      CreateCloneTrooper(game.currentGameState, player, log, "TWI_007");
      return null;
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
    default:
      return null;
  }
}
