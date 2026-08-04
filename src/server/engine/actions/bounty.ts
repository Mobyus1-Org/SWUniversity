import type { PlayerId } from "@/lib/engine/core-models";
import { CardIsUnique } from "@/server/engine/card-db/generated";
import type { Unit } from "@/server/engine/unit";
import type { BountyPending, PendingResolution } from "@/server/engine/pending-resolution";

type BountyEffect = {
  kind: "draw-card" | "give-shield" | "ready-2-resources" | "play-free-under-control" | "deal-base-damage";
  sourceCardId: string;
};

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
      case "SHD_221": // Wanted — grants Bounty: Ready 2 friendly resources
        effects.push({ kind: "ready-2-resources", sourceCardId: "SHD_221" });
        break;
      case "SHD_173": // Guild Target — grants Bounty: "Deal 2 damage to a base. If this unit is
                      // unique, deal 3 damage instead." The amount is fixed into the ability id
                      // here, at the moment of defeat, because the unit has left play by the time
                      // the prompt is answered and its uniqueness can no longer be looked up.
        effects.push({
          kind: "deal-base-damage",
          sourceCardId: CardIsUnique(unit.cardId) ? "SHD_173_3" : "SHD_173_2",
        });
        break;
      case "SHD_226": // Unrefusable Offer — grants Bounty: play this unit from its owner's discard
                      // pile or from capture for free, under your control.
        effects.push({ kind: "play-free-under-control", sourceCardId: "SHD_226" });
        break;
    }
  }

  return effects;
}

/**
 * Draws one card from the top of `player`'s deck into their hand.
 * If deck is empty, logs and does nothing (empty-deck damage only applies during Regroup).
 */

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
      // Recorded now, while the unit is still in hand: by the time the prompt is answered it has
      // left play, and SHD_226 needs its identity to find the card again.
      targetCardId: unit.cardId,
      targetPlayId: unit.playId,
      targetOwner: unit.owner,
      continuation: chain,
    } satisfies BountyPending;
  }
  return chain as BountyPending;
}
