import { CardTitle } from "@/server/engine/card-db/generated";
import type { GameDispatch } from "@/lib/engine/message-types";
import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";

function title(cardId: string): string {
  const t = CardTitle(cardId);
  return t !== "" ? t : cardId;
}

export function formatStep(dispatch: GameDispatch, snapshot: GameState): string {
  const p1 = snapshot.player1;
  const p2 = snapshot.player2;
  const allUnits = [
    ...p1.groundArena,
    ...p1.spaceArena,
    ...p2.groundArena,
    ...p2.spaceArena,
  ];
  const allResources = [...p1.resources, ...p2.resources];

  switch (dispatch.dispatchType) {
    case "play-card": {
      const { cardId } = dispatch.dispatchData as { cardId: string };
      return `Play ${title(cardId)}`;
    }

    case "play-smuggle": {
      const { playId } = dispatch.dispatchData as { playId: string };
      const resource = allResources.find(r => r.playId === playId);
      return `Smuggle ${resource ? title(resource.cardId) : playId}`;
    }

    case "initiate-attack": {
      const { playId } = dispatch.dispatchData as { playId: string };
      const unit = allUnits.find(u => u.playId === playId);
      return `Attack with ${unit ? title(unit.cardId) : playId}`;
    }

    case "use-ability": {
      const { cardId, deployLeader } = dispatch.dispatchData as {
        cardId: string;
        deployLeader?: boolean;
      };
      const cardTitle = title(cardId);
      if (deployLeader) return `Deploy ${cardTitle}`;
      return `Use ${cardTitle}'s ability`;
    }

    case "pass-action":
      return "Pass action";

    case "claim-initiative":
      return "Claim initiative";

    case "choose-target": {
      const { targetPlayIds, targetZones, targetPlayers, targetIndices } =
        dispatch.dispatchData as {
          targetPlayIds?: string[];
          targetZones?: string[];
          targetPlayers?: PlayerId[];
          targetIndices?: number[];
        };

      // targetPlayers is set by the solver's action enumerator (not the engine) to indicate which base
      if (targetZones?.includes("Base")) {
        const owner = targetPlayers?.[0] === 1 ? "own" : "opponent's";
        return `→ target ${owner} base`;
      }

      if (targetPlayIds?.[0]) {
        const id = targetPlayIds[0];
        const unit = allUnits.find(u => u.playId === id);
        return `→ target ${unit ? title(unit.cardId) : id}`;
      }

      if (targetZones?.includes("Hand") && targetIndices?.[0] !== undefined) {
        const card = p1.hand[targetIndices[0]];
        return `→ choose hand[${targetIndices[0]}]${card ? ` (${title(card.cardId)})` : ""}`;
      }

      if (targetZones?.includes("Leader")) {
        const owner = targetPlayers?.[0] === 1 ? "own" : "opponent's";
        return `→ target ${owner} leader`;
      }

      return `→ choose target`;
    }

    case "choose-option": {
      const { option } = dispatch.dispatchData as { option: string };
      return `→ choose "${option}"`;
    }

    case "choose-player": {
      const { playerId } = dispatch.dispatchData as { playerId: number };
      return `→ choose player ${playerId}`;
    }

    default:
      return dispatch.dispatchType;
  }
}
