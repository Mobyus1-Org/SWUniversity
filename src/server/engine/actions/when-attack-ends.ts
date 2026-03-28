import { HasWhenAttackEnds } from "@/server/engine/card-db/keyword-dictionaries.ts/when-attack-ends";
import { GetGame, GetUnitsForPlayer, TraitContains } from "@/server/engine/core-functions";
import { PendingResolution } from "@/server/engine/pending-resolution";
import { Unit } from "@/server/engine/unit";

export function resolveWhenAttackEnds(
  attacker: Unit,
  //defender: Unit
): PendingResolution | null {
  const game = GetGame();
  if (!game) throw new Error("Game not found in resolveWhenAttackEnds");
  if(!attacker.LostAbilities() && HasWhenAttackEnds(attacker.cardId)) {
    switch(attacker.cardId) {
      case "SOR_009": //Leia Organa "When this unit completes an attack: You may attack with another Rebel unit."
        return {
          type: "ability-target",
          cardId: attacker.cardId,
          fromPlayIds: GetUnitsForPlayer(attacker.controller, true).filter((u) =>
            TraitContains(u.cardId, "Rebel", u.controller, u.playId) && u.playId !== attacker.playId).map((u) => u.playId),
          continuation: null,
        }
      default: return null;
    }
  }

  return null;
}