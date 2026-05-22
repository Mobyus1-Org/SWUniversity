import { PlayerId } from "@/lib/engine/core-models";
import { GetGame, GetUnitsForPlayer, TraitContains, CardIsLeader } from "@/server/engine/core-functions";
import { PayToMoveGroundPending, PendingResolution } from "@/server/engine/pending-resolution";
import { Unit } from "@/server/engine/unit";

/**
 * When Played abilities for unit cards.
 * Return a PendingResolution if further input is needed, or null to auto-resolve.
 */
export function resolveWhenPlayed(
  cardId: string,
  player: PlayerId,
  playId?: string,
): PendingResolution | null {
  const game = GetGame();
  if (!game) throw new Error("Game not found in resolveWhenPlayedAbility");
  switch (cardId) {
    case "SOR_103": { //Rebel Assault "Attack with a Rebel unit. It gets +1/+0 for this attack. Then, attack with another Rebel unit. It gets +1/+0 for this attack."
      const rebelPlayIds = GetUnitsForPlayer(player, true).filter((u) =>
        TraitContains(u.cardId, "Rebel", u.controller, u.playId)).map((u) => u.playId);
      if (rebelPlayIds.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: rebelPlayIds,
        continuation: {
          type: "ability-target",
          cardId,
          fromPlayIds: rebelPlayIds,
          continuation: null,
        }
      };
    }
    case "SOR_168": //Precision Fire "Attack with a unit. It gains Saboteur for this attack. If it's a Trooper, it also gets +2/+0 for this attack. (Ignore Sentinel and defeat the defender's Shields.)"
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: GetUnitsForPlayer(player, true).map((u) => u.playId),
        continuation: null,
      }
    case "JTL_153": //Rebellious Hammerhead "When Played: You may deal damage to a unit equal to the number of cards in your hand."
      if (!playId && !player) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId!,
        helperText: "Deal damage to a unit equal to the number of cards in your hand?",
        onYes: {
          type: "ability-target",
          cardId,
          sourcePlayId: playId!,
          // Populate all units from both players (including itself — it's already in the arena)
          fromPlayIds: [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)].map((u) => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    case "SEC_034": { // Cad Bane — "When Played: You may defeat a unit with 2 or less remaining HP."
      const allUnits = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      const eligible = allUnits.filter(u => Unit.FromInterface(u).CurrentHP() <= 2);
      if (eligible.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SEC_034",
        fromPlayIds: eligible.map(u => u.playId),
        continuation: null,
      };
    }
    case "SHD_160": //Reckless Gunslinger "When Played: Deal 1 damage to each base."
      // This is a simple effect that doesn't require any player input, so we can resolve it immediately without returning a PendingResolution.
      return null;
    case "TWI_128": { // Take Captive "A friendly unit captures an enemy non-leader unit in the same arena."
      const friendlyUnits = GetUnitsForPlayer(player, true);
      if (friendlyUnits.length === 0) return null;
      return {
        type: "capture-captor",
        cardId,
        fromPlayer: player,
        eligiblePlayIds: friendlyUnits.map(u => u.playId),
      };
    }
    case "SOR_224": { // Change of Heart — "Take control of a non-leader unit."
      const allNonLeaders = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => !CardIsLeader(u.cardId));
      if (allNonLeaders.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_224",
        player,
        fromPlayIds: allNonLeaders.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_222": { // Waylay — "Return a non-leader unit to its owner's hand."
      const allNonLeaders = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => !CardIsLeader(u.cardId));
      if (allNonLeaders.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_222",
        player,
        fromPlayIds: allNonLeaders.map(u => u.playId),
        continuation: null,
      };
    }
    case "JTL_096": { // Blue Leader — "You may pay 2 resources. If you do, move this unit to the ground arena and give 2 Experience tokens to it."
      if (!playId) return null;
      return {
        type: "pay-to-move-ground",
        cardId: "JTL_096",
        sourcePlayId: playId,
        player,
        cost: 2,
        continuation: null,
      };
    }
    case "SOR_251": { // Confiscate — "Defeat an upgrade."
      const allUpgradePlayIds = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .flatMap(u => u.upgrades.map(upg => upg.playId));
      if (allUpgradePlayIds.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_251",
        player,
        fromPlayIds: allUpgradePlayIds,
        continuation: null,
      };
    }
    default:
      return null;
  }
}