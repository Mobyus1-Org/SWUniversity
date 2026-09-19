import type { PlayerId } from "@/lib/engine/core-models";

/**
 * Fortify — "Attach this to your base, not a unit."
 *
 * A hand-written switch like every other keyword dictionary: keywords are never inferred from
 * card text, so a card missing from this list silently has no Fortify and would be offered
 * ordinary unit targets instead.
 *
 * Most of these carry a "Fortification" trait too, but the trait is flavour — HMW_206 has Fortify
 * with the trait "Law". The keyword is what changes where the upgrade attaches.
 * tests/unit/engine/fortify-registry.test.ts pins this list to the printed keyword.
 */
export function HasFortify(cardId: string): boolean {
  switch (cardId) {
    case "HMW_081": // Alliance Shield Generator
    case "HMW_171": // Trap Field
    case "HMW_070": // Dark Sanctum
    case "HMW_037": // Bacta Tank
    case "HMW_095": // Carbonite Chamber
    case "HMW_112": // Military Academy
    case "HMW_113": // Sinister War Memorial
    case "HMW_126": // Verdant Fortress
    case "HMW_147": // Beast Lair
    case "HMW_160": // Noxious Refinery
    case "HMW_172": // Heavy Ion Cannon
    case "HMW_205": // Intelligence Agency
    case "HMW_206": // The Tarkin Doctrine (trait "Law", not "Fortification")
    case "HMW_216": // Insurgent Camp
    case "HMW_271": // Landing Pad
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
