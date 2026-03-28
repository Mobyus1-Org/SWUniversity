import { GetGame, GetUnitsForPlayer, TraitContains } from "../core-functions";
import { PendingResolution } from "../pending-resolution";
import { PlayerId } from "@/lib/engine/core-models";

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
    case "SOR_103": //Rebel Assault "Attack with a Rebel unit. It gets +1/+0 for this attack. Then, attack with another Rebel unit. It gets +1/+0 for this attack."
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: GetUnitsForPlayer(player).filter((u) =>
          TraitContains(u.cardId, "Rebel", u.controller, u.playId)).map((u) => u.playId),
        continuation: {
          type: "ability-target",
          cardId,
          fromPlayIds: GetUnitsForPlayer(player).filter((u) =>
            TraitContains(u.cardId, "Rebel", u.controller, u.playId)).map((u) => u.playId),
          continuation: null,
        }
      }
    case "SOR_168": //Precision Fire "Attack with a unit. It gains Saboteur for this attack. If it's a Trooper, it also gets +2/+0 for this attack. (Ignore Sentinel and defeat the defender's Shields.)"
      if (!playId) return null;
      return {
        type: "ability-target",
        cardId,
        sourcePlayId: playId,
        fromPlayIds: GetUnitsForPlayer(player).map((u) => u.playId),
        continuation: null,
      }
    case "JTL_153": //Rebelliious Hammerhead "When Played: You may deal damage to a unit equal to the number of cards in your hand."
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
          fromPlayIds: [], // all units so no filter needed
          continuation: null,
        },
        continuation: null,
      };
    case "SHD_160": //Reckless Gunslinger "When Played: Deal 1 damage to each base."
      // This is a simple effect that doesn't require any player input, so we can resolve it immediately without returning a PendingResolution.
      return null;
    default:
      return null;
  }
}