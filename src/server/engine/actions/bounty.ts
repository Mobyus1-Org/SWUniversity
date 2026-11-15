import type { PlayerId } from "@/lib/engine/core-models";
import { CardIsUnique } from "@/server/engine/card-db/generated";
import { GetGame } from "@/server/engine/core-functions";
import type { Unit } from "@/server/engine/unit";
import type { BountyPending, PendingResolution } from "@/server/engine/pending-resolution";

type BountyEffect = {
  kind: "draw-card" | "give-shield" | "ready-2-resources" | "play-free-under-control" | "deal-base-damage"
    | "heal-base" | "next-unit-discount" | "deal-unit-damage" | "heal-unit-or-base" | "search-play"
    | "resource-top-card" | "replay-own" | "draw-cards" | "search-draw" | "xp-up-to-2";
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
    case "SHD_058": // Val — "Bounty — Deal 3 damage to a unit."
      if (!unit.LostAbilities()) effects.push({ kind: "deal-unit-damage", sourceCardId: "SHD_058" });
      break;
    case "SHD_161": // Stolen Landspeeder — "Bounty — If you own this unit, play it from your discard
                    // pile for free and give an Experience token to it."
      if (!unit.LostAbilities()) effects.push({ kind: "replay-own", sourceCardId: "SHD_161" });
      break;
    case "SHD_165": // Unlicensed Headhunter — while exhausted: "Bounty — Heal 5 damage from your base."
      if (!unit.ready && !unit.LostAbilities()) effects.push({ kind: "heal-base", sourceCardId: "SHD_165" });
      break;
    case "SHD_033": // Synara San — "While this unit is exhausted, she gains 'Bounty — Deal 5 damage
                    // to a base.'" Read as she left play: exhausted then, she had it.
      if (!unit.ready && !unit.LostAbilities()) effects.push({ kind: "deal-base-damage", sourceCardId: "SHD_033" });
      break;
  }

  // Bounties granted for the phase by an ability, keyed on this unit's playId.
  for (const effect of GetGame()?.currentGameState.currentEffects ?? []) {
    if (effect.targetPlayId !== unit.playId) continue;
    switch (effect.cardId) {
      case "SHD_006": // Jabba the Hutt — "Bounty — The next unit you play this phase costs N less."
        effects.push({ kind: "next-unit-discount", sourceCardId: (effect.value ?? 1) >= 2 ? "SHD_006_2" : "SHD_006_1" });
        break;
      case "SHD_031": // The Client — "Bounty — Heal 5 damage from a base."
        effects.push({ kind: "heal-base", sourceCardId: "SHD_031" });
        break;
    }
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
      case "SHD_071": // Top Target — "Heal 4 damage from a unit or base. If this unit is unique, heal 6."
        effects.push({ kind: "heal-unit-or-base", sourceCardId: CardIsUnique(unit.cardId) ? "SHD_071_6" : "SHD_071_4" });
        break;
      case "SHD_123": // Bounty Hunter's Quarry — search 5 (10 if unique) for a unit costing 3 or less, play it free.
        effects.push({ kind: "search-play", sourceCardId: CardIsUnique(unit.cardId) ? "SHD_123_10" : "SHD_123_5" });
        break;
      case "SHD_125": // Price on Your Head — "Put the top card of your deck into play as a resource."
        effects.push({ kind: "resource-top-card", sourceCardId: "SHD_125" });
        break;
      case "SHD_176": // Death Mark — "Draw 2 cards."
        effects.push({ kind: "draw-cards", sourceCardId: "SHD_176" });
        break;
      case "SHD_222": // Enticing Reward — search 10 for 2 non-unit cards and draw them; then, if this
                      // unit isn't unique, discard a card from your hand.
        effects.push({ kind: "search-draw", sourceCardId: CardIsUnique(unit.cardId) ? "SHD_222" : "SHD_222_discard" });
        break;
      case "SHD_261": // Rich Reward — "Give an Experience token to each of up to 2 units."
        effects.push({ kind: "xp-up-to-2", sourceCardId: "SHD_261" });
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
