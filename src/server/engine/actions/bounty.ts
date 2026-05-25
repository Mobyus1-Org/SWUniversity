import type { GameState, PlayerState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";
import type { Unit } from "@/server/engine/unit";
import type { BountyPending, PendingResolution } from "@/server/engine/pending-resolution";

function ps(gs: GameState, player: PlayerId): PlayerState {
  return player === 1 ? gs.player1 : gs.player2;
}

type BountyEffect = { kind: "draw-card" | "give-shield"; sourceCardId: string };

/**
 * Returns the bounty effects on a unit at the moment of defeat/capture.
 * Does NOT call GetUnitInPlay — unit may already be removed from play.
 */
function getBountyEffects(unit: Unit): BountyEffect[] {
  const effects: BountyEffect[] = [];

  switch (unit.cardId) {
    case "SHD_027": // Hylobon Enforcer — Bounty: Draw a card
      effects.push({ kind: "draw-card", sourceCardId: "SHD_027" });
      break;
  }

  for (const upgrade of unit.upgrades) {
    switch (upgrade.cardId) {
      case "SHD_068": // Public Enemy — grants Bounty: Give a Shield token to a unit
        effects.push({ kind: "give-shield", sourceCardId: "SHD_068" });
        break;
    }
  }

  return effects;
}

/**
 * Draws one card from the top of `player`'s deck into their hand.
 * If deck is empty, logs and does nothing (empty-deck damage only applies during Regroup).
 */
export function drawCardForPlayer(gs: GameState, log: string[], player: PlayerId): void {
  const p = ps(gs, player);
  if (p.deck.length > 0) {
    const card = p.deck.pop()!;
    p.hand.push(card);
    log.push(`Player ${player} collected a bounty and drew a card.`);
  } else {
    log.push(`Player ${player} collected a bounty but their deck was empty.`);
  }
}

/**
 * Builds a linked chain of BountyPending resolutions for all bounties on `unit`.
 * The last bounty in the chain receives `continuation` as its continuation.
 * Returns null if the unit has no bounty effects.
 */
export function collectBounties(
  unit: Unit,
  collectingPlayer: PlayerId,
  continuation: PendingResolution | null,
): BountyPending | null {
  const effects = getBountyEffects(unit);
  if (effects.length === 0) return null;

  let chain: PendingResolution | null = continuation;
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    chain = {
      type: "bounty",
      cardId: effect.sourceCardId,
      collectingPlayer,
      continuation: chain,
    } satisfies BountyPending;
  }
  return chain as BountyPending;
}
