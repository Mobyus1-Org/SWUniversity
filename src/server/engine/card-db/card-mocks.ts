import mockData from "@/server/engine/card-db/card-mocks.json";

/**
 * A hand-curated card definition for a previewed (unreleased) card.
 *
 * Mocks are a temporary overlay, never a fork: official data always wins, and deleting an entry
 * removes the card on the next generator run. Keyed by the ordinary `SET_NNN` id so puzzles, card
 * implementations and tests do not change when the card is released.
 *
 * See docs/superpowers/specs/2026-08-11-card-mock-framework-design.md.
 */
export type MockCard = {
  title: string;
  subtitle: string;
  /** "Leader" | "Base" | "Unit" | "Event" | "Upgrade" */
  type: string;
  /** "Unit" for an ordinary leader; "Leader" marks a double-sided leader. Empty otherwise. */
  type2: string;
  /** "Ground" | "Space", or empty for cards with no arena (events, upgrades, bases). */
  arena: string;
  cost: number | null;
  power: number | null;
  hp: number | null;
  upgradePower: number | null;
  upgradeHp: number | null;
  aspects: string[];
  traits: string[];
  text: string;
  epicAction: string;
  /** The deployed side's rules text. The official API calls this field `deployBox`. */
  leaderUnitText: string;
  unique: boolean;
  rarity: string;
  set: string;
  imageUrl: string;
  imageUrlBack: string;
};

export const cardMocks = mockData as Record<string, MockCard>;

export const MOCK_CARD_IDS = Object.keys(cardMocks);

export function isMockCardId(cardId: string): boolean {
  return cardId in cardMocks;
}
