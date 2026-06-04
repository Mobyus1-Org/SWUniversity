import { randomUUID } from "crypto";
import { CardIsPlayable, ResourceIsSmuggleable } from "@/server/engine/card-playability";
import type { GameState } from "@/lib/engine/game";
import type { GameDispatch, ResolutionRequest } from "@/lib/engine/message-types";
import type { PlayerId } from "@/lib/engine/core-models";

function makeDispatch(
  player: PlayerId,
  type: GameDispatch["dispatchType"],
  data: GameDispatch["dispatchData"],
): GameDispatch {
  return {
    dispatchId: randomUUID(),
    dispatchType: type,
    dispatchData: data,
    fromPlayer: player,
  };
}

export function getTopLevelActions(gs: GameState): GameDispatch[] {
  if (gs.activePlayer === 2) {
    return [makeDispatch(2, "pass-action", {})];
  }

  const p = gs.player1;
  const dispatches: GameDispatch[] = [];

  // use-ability: deploy leader first — deploy solutions are short paths; finding them before
  // exploring attack sub-trees avoids exhausting the time budget on large attack+card-play trees
  const leader = p.leader;
  if (!leader.epicActionUsed && !leader.deployed) {
    dispatches.push(
      makeDispatch(1, "use-ability", { cardId: leader.cardId, deployLeader: true, epicAction: true }),
    );
  }

  // initiate-attack: each ready unit — before card plays so combat paths are explored early
  for (const unit of [...p.groundArena, ...p.spaceArena]) {
    if (unit.ready) {
      dispatches.push(makeDispatch(1, "initiate-attack", { playId: unit.playId }));
    }
  }

  // play-card: each affordable card in hand — before leader/unit action abilities so card-play
  // winning paths are found before the solver exhausts large leader-ability sub-trees.
  // Deploy and attacks stay first (short paths); non-deploy leader ability is tried after cards.
  for (const card of p.hand) {
    if (CardIsPlayable(gs, 1, card.cardId)) {
      dispatches.push(makeDispatch(1, "play-card", { cardId: card.cardId, fromZone: "Hand" }));
    }
  }

  // play-smuggle: each smuggleable resource
  for (const resource of p.resources) {
    if (ResourceIsSmuggleable(gs, 1, resource)) {
      dispatches.push(makeDispatch(1, "play-smuggle", { playId: resource.playId }));
    }
  }

  // use-ability: leader non-deploy ability — gated on ready+not-deployed, not on epicActionUsed,
  // since epicActionUsed only prevents the deploy epic action, not the regular leader action ability.
  if (!leader.deployed && leader.ready) {
    dispatches.push(makeDispatch(1, "use-ability", { cardId: leader.cardId }));
  }

  // use-ability: deployed leader unit (action ability)
  if (leader.deployed && leader.deployedPlayId) {
    dispatches.push(
      makeDispatch(1, "use-ability", { cardId: leader.cardId, playId: leader.deployedPlayId }),
    );
  }

  // use-ability: unit action abilities — engine rejects if no ability exists, same as leader pattern
  for (const unit of [...p.groundArena, ...p.spaceArena]) {
    if (unit.ready) {
      dispatches.push(makeDispatch(1, "use-ability", { cardId: unit.cardId, playId: unit.playId }));
    }
  }

  // use-ability: base
  if (!p.base.epicActionUsed) {
    dispatches.push(makeDispatch(1, "use-ability", { cardId: p.base.cardId }));
  }

  // claim-initiative
  dispatches.push(makeDispatch(1, "claim-initiative", {}));

  // pass-action: always available
  dispatches.push(makeDispatch(1, "pass-action", {}));

  return dispatches;
}

export function getResolutionActions(resolution: ResolutionRequest, gs: GameState): GameDispatch[] {
  const dispatches: GameDispatch[] = [];

  switch (resolution.type) {
    case "Target": {
      // Zone-based base targets — opponent's base first so DFS finds the kill blow quickly
      if (resolution.fromZones?.includes("Base")) {
        dispatches.push(
          makeDispatch(1, "choose-target", { targetZones: ["Base"], targetPlayers: [2] }),
        );
        dispatches.push(
          makeDispatch(1, "choose-target", { targetZones: ["Base"], targetPlayers: [1] }),
        );
      }
      // Each fromPlayId as a single-target dispatch
      for (const playId of resolution.fromPlayIds ?? []) {
        dispatches.push(makeDispatch(1, "choose-target", { targetPlayIds: [playId] }));
      }
      if (resolution.fromZones?.includes("Leader")) {
        dispatches.push(
          makeDispatch(1, "choose-target", { targetZones: ["Leader"], targetPlayers: [1] }),
        );
        dispatches.push(
          makeDispatch(1, "choose-target", { targetZones: ["Leader"], targetPlayers: [2] }),
        );
      }
      // Hand-index targets — fall back to full hand when fromIndices is absent
      const handIndices =
        resolution.fromIndices ??
        (resolution.fromZones?.includes("Hand") ? gs.player1.hand.map((_, i) => i) : []);
      if (resolution.needsMultiple && handIndices.length > 0) {
        // Multi-select hand (e.g. reveal-from-hand): try reveal-all and reveal-none
        dispatches.push(makeDispatch(1, "choose-target", { targetIndices: handIndices }));
        dispatches.push(makeDispatch(1, "choose-target", { targetIndices: [] }));
      } else {
        for (const idx of handIndices) {
          dispatches.push(
            makeDispatch(1, "choose-target", {
              targetZones: ["Hand"],
              targetPlayers: [1],
              targetIndices: [idx],
            }),
          );
        }
      }
      break;
    }
    case "Option": {
      for (const option of resolution.options) {
        dispatches.push(makeDispatch(1, "choose-option", { option }));
      }
      break;
    }
    case "Player": {
      for (const playerId of resolution.fromPlayers) {
        dispatches.push(makeDispatch(1, "choose-player", { playerId }));
      }
      break;
    }
    case "Trigger": {
      for (const cardId of resolution.fromCardIds) {
        dispatches.push(makeDispatch(1, "choose-trigger", { cardId }));
      }
      break;
    }
    case "Plot": {
      for (const playId of resolution.fromPlayIds) {
        dispatches.push(makeDispatch(1, "choose-target", { targetPlayIds: [playId] }));
      }
      dispatches.push(makeDispatch(1, "pass-action", {}));
      break;
    }
    case "SpreadDamage": {
      const { totalDamage, eligiblePlayIds, includesBase } = resolution;
      // Try putting all damage on each individual unit
      for (let i = 0; i < eligiblePlayIds.length; i++) {
        const assignments = eligiblePlayIds.map((id, j) => ({
          playId: id,
          damage: j === i ? totalDamage : 0,
        }));
        dispatches.push(makeDispatch(1, "choose-target", { spreadDamageAssignments: assignments }));
      }
      // If base is a valid target, try all damage on opponent's base
      if (includesBase) {
        const assigningPlayer = resolution.assigningPlayer ?? 1;
        const opponentBase = assigningPlayer === 1 ? "player2.base" : "player1.base";
        const baseAssignments = [
          ...eligiblePlayIds.map(id => ({ playId: id, damage: 0 })),
          { playId: opponentBase, damage: totalDamage },
        ];
        dispatches.push(makeDispatch(1, "choose-target", { spreadDamageAssignments: baseAssignments }));
      }
      // If optional, also try declining (0 damage to everyone)
      if (resolution.optional) {
        const zeroAssignments = eligiblePlayIds.map(id => ({ playId: id, damage: 0 }));
        dispatches.push(makeDispatch(1, "choose-target", { spreadDamageAssignments: zeroAssignments }));
      }
      break;
    }
    case "PeekHand": {
      if (resolution.mustDiscard) {
        for (const idx of resolution.eligibleIndices) {
          dispatches.push(makeDispatch(1, "choose-target", { targetIndices: [idx] }));
        }
      } else {
        // Player may decline to discard
        dispatches.push(makeDispatch(1, "choose-target", { targetIndices: [] }));
        for (const idx of resolution.eligibleIndices) {
          dispatches.push(makeDispatch(1, "choose-target", { targetIndices: [idx] }));
        }
      }
      break;
    }
    case "DeckSearch": {
      // Take nothing
      dispatches.push(makeDispatch(1, "choose-target", { targetPlayIds: [] }));
      // Take each card individually
      for (const choice of resolution.choices) {
        dispatches.push(makeDispatch(1, "choose-target", { targetPlayIds: [choice.tempId] }));
      }
      break;
    }
  }

  return dispatches;
}
