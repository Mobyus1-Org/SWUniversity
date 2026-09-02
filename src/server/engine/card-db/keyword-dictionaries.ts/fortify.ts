import type { PlayerId } from "@/lib/engine/core-models";

/**
 * Fortify — "Attach this to your base, not a unit."
 *
 * A hand-written switch like every other keyword dictionary: keywords are never inferred from
 * card text, so a card missing from this list silently has no Fortify and would be offered
 * ordinary unit targets instead.
 *
 * These cards carry a "Fortification" trait too, but the trait is flavour that a future
 * non-Fortify card could also print — the keyword is what changes where the upgrade attaches.
 */
export function HasFortify(cardId: string): boolean {
  switch (cardId) {
    case "HMW_081": // Alliance Shield Generator
    case "HMW_171": // Trap Field
    case "HMW_070": // Dark Sanctum
      return true;
    default:
      return false;
  }
}

/** The synthetic playId a player's base answers to as a target. */
export function BaseTargetId(player: PlayerId): string {
  return `player${player}.base`;
}

/** The player whose base `playId` refers to, or null when it is not a base target at all. */
export function BaseTargetPlayer(playId: string): PlayerId | null {
  if (playId === "player1.base") return 1;
  if (playId === "player2.base") return 2;
  return null;
}
