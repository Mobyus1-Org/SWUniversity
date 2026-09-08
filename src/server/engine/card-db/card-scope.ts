import { GetAllCardIds } from "@/server/engine/card-db/generated";

/** Sets the board and the puzzle editor both cover. Moved here from card-catalog.ts. */
export const CATALOG_SETS = new Set([
  "SOR", "SHD", "TWI", "JTL", "LOF", "SEC", "IBH", "LAW", "TS26", "ASH",
  "HMW", // preview set — mocked cards, offered so puzzles can be authored ahead of release
]);

/**
 * Sets deliberately kept out: promo and convention printings that duplicate a base-set card under
 * a different id.
 */
export const EXCLUDED_SETS = new Set([
  // Promo reprints — a "<SET>P" id is the same card as its base-set printing.
  "ASHP", "LAWP", "JTLP", "LOFP", "SECP",
  // Convention, judge and other special printings.
  "C24", "C25", "C26", "G25", "GG", "J24", "J25", "MV26", "P25", "P26",
]);

/**
 * The cards the implementation board tracks: every card in a real or preview set, minus tokens
 * and promo printings.
 *
 * The set check reads the ID PREFIX, not the `cardSet` field. A promo such as ASHP_003 carries
 * cardSet "ASH" but the prefix "ASHP", which is not in CATALOG_SETS — filtering on the field
 * would silently keep 385 duplicate promo printings.
 */
export function IsInScopeBoardCard(cardId: string): boolean {
  if (cardId.includes("_T")) return false; // token printings
  return CATALOG_SETS.has(cardId.split("_")[0]);
}

let cached: string[] | null = null;

export function InScopeBoardCardIds(): string[] {
  if (!cached) {
    cached = GetAllCardIds().filter(IsInScopeBoardCard).sort((a, b) => a.localeCompare(b));
  }
  return cached;
}
