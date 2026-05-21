import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import { CardAspects, CardCost, CardType } from "@/server/engine/card-db/generated";
import { UpgradeEligibleTargets } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { ExploitAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/exploit";

function playCost(game: GameState, player: PlayerId, cardId: string): number {
  const p = player === 1 ? game.player1 : game.player2;
  const provided = [...CardAspects(p.base.cardId), ...CardAspects(p.leader.cardId)];
  const counts = new Map<string, number>();
  for (const a of provided) counts.set(a, (counts.get(a) ?? 0) + 1);
  let missing = 0;
  for (const a of CardAspects(cardId)) {
    const rem = counts.get(a) ?? 0;
    if (rem > 0) counts.set(a, rem - 1);
    else missing++;
  }
  return CardCost(cardId) + missing * 2;
}

export function CardIsPlayable(game: GameState, player: PlayerId, cardId: string): boolean {
  const p = player === 1 ? game.player1 : game.player2;
  const readyResources = p.resources.filter(r => r.ready).length;
  const fullCost = playCost(game, player, cardId);
  const exploitAmt = ExploitAmount(cardId, "hand", player, true);
  const numUnits = p.groundArena.length + p.spaceArena.length;
  const minCost = Math.max(0, fullCost - Math.min(exploitAmt, numUnits) * 2);
  if (readyResources < minCost) return false;

  if (CardType(cardId) === "Upgrade") {
    return UpgradeEligibleTargets(cardId, game, player).length > 0;
  }

  return true;
}
